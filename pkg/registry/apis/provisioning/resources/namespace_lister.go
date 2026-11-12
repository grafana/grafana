package resources

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/util/sets"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	provisioningresources "github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Optional ResourceListItem fields a namespace list may project. They describe the
// resource as its repository holds it, so only a managed row ever carries them, and
// reading them costs stored fields the narrow set does not.
const (
	FieldPath = "path"
	FieldHash = "hash"
	FieldTime = "time"
)

// ProjectableFields are the field names NamespaceListOptions.Fields accepts.
var ProjectableFields = sets.New(FieldPath, FieldHash, FieldTime)

// DefaultNamespaceListLimit is the page size used when a request does not ask for one.
const DefaultNamespaceListLimit = 500

// MaxNamespaceListLimit caps the page size a request may ask for.
const MaxNamespaceListLimit = 10000

// NamespaceListOptions selects what a namespace-wide resource list returns.
type NamespaceListOptions struct {
	// ManagerKind and ManagerID restrict the list to one manager, as the
	// repository-scoped list does.
	ManagerKind string
	ManagerID   string
	// Managed restricts to managed or unmanaged resources; nil means both.
	Managed *bool
	// Group and Resource restrict the list to one kind. Resource is the plural name.
	Group    string
	Resource string
	// Limit is the maximum number of items in one page.
	Limit int64
	// Continue resumes a previous page; it is opaque to the caller.
	Continue string
	// Fields names the optional projections, from ProjectableFields.
	Fields sets.Set[string]
}

// NamespaceLister reads what a whole namespace holds and who manages it.
//
//go:generate mockery --name NamespaceLister --structname MockNamespaceLister --inpackage --filename namespace_lister_mock.go --with-expecter
type NamespaceLister interface {
	ListNamespace(ctx context.Context, namespace string, opts NamespaceListOptions) (*provisioning.ResourceList, error)
}

// NamespaceListerFromSearch answers a namespace list from the unified search index.
//
// The index is searched once per kind rather than with one federated request:
// federated search is being withdrawn, and a per-kind request is what keeps paging
// resumable at the kind it stopped in.
type NamespaceListerFromSearch struct {
	store ResourceStore
	// clients resolves a configured kind to the plural resource the index is keyed by.
	clients ClientFactory
	// configured is the whole configured set, disabled entries included: a disabled
	// kind is still in the namespace and still counted by stats.
	configured []SupportedResource
}

func NewNamespaceLister(store ResourceStore, clients ClientFactory, configured []SupportedResource) *NamespaceListerFromSearch {
	return &NamespaceListerFromSearch{store: store, clients: clients, configured: configured}
}

// namespaceListCursor is the decoded form of NamespaceListOptions.Continue: the kind a
// page stopped in and the sort values to resume it after.
type namespaceListCursor struct {
	Group    string   `json:"g"`
	Resource string   `json:"r"`
	After    []string `json:"a,omitempty"`
}

func encodeCursor(c namespaceListCursor) (string, error) {
	raw, err := json.Marshal(c)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

// A malformed token is the caller's mistake, so it carries a status the HTTP route
// reports as a bad request rather than a server error.
func decodeCursor(token string) (namespaceListCursor, error) {
	var c namespaceListCursor
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return c, apierrors.NewBadRequest("invalid continue token")
	}
	if err := json.Unmarshal(raw, &c); err != nil {
		return c, apierrors.NewBadRequest("invalid continue token")
	}
	if c.Group == "" || c.Resource == "" {
		return c, apierrors.NewBadRequest("invalid continue token")
	}
	return c, nil
}

// ListNamespace implements NamespaceLister.
func (l *NamespaceListerFromSearch) ListNamespace(ctx context.Context, namespace string, opts NamespaceListOptions) (*provisioning.ResourceList, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
	limit := opts.Limit
	switch {
	case limit <= 0:
		limit = DefaultNamespaceListLimit
	case limit > MaxNamespaceListLimit:
		limit = MaxNamespaceListLimit
	}

	// Everything derived from the request alone is settled before discovery, so a
	// malformed one is rejected without a round trip.
	var cursor namespaceListCursor
	if opts.Continue != "" {
		var err error
		if cursor, err = decodeCursor(opts.Continue); err != nil {
			return nil, err
		}
	}
	filters, err := managerFilters(opts)
	if err != nil {
		return nil, err
	}
	fields := responseFields(opts.Fields)
	// managed=false is only half expressible as an index filter; see unmanagedRow.
	var keep func(provisioning.ResourceListItem) bool
	if opts.Managed != nil && !*opts.Managed {
		keep = unmanagedRow
	}

	keys, err := l.indexKeys(ctx, namespace)
	if err != nil {
		return nil, err
	}
	if keys, err = filterKeys(keys, opts.Group, opts.Resource); err != nil {
		return nil, err
	}

	if opts.Continue != "" {
		start := slices.IndexFunc(keys, func(k schema.GroupResource) bool {
			return k.Group == cursor.Group && k.Resource == cursor.Resource
		})
		if start < 0 {
			// Resuming is impossible — a token cannot be rewritten into a different
			// kind — and answering with a final empty page would present a truncated
			// inventory as a complete one.
			return nil, apierrors.NewBadRequest(fmt.Sprintf(
				"continue token resumes %s, which this namespace no longer lists; restart the listing",
				cursor.Group+"/"+cursor.Resource))
		}
		keys = keys[start:]
	}

	list := &provisioning.ResourceList{Items: make([]provisioning.ResourceListItem, 0, limit)}
	after := cursor.After
	for i, key := range keys {
		for int64(len(list.Items)) < limit {
			rows, sortFields, err := l.searchKind(ctx, namespace, key, filters, fields, limit-int64(len(list.Items)), after, keep)
			if err != nil {
				return nil, err
			}
			list.Items = append(list.Items, rows...)
			if sortFields == nil {
				// The kind is exhausted; the next one starts from its beginning.
				after = nil
				break
			}
			after = sortFields
		}
		if int64(len(list.Items)) < limit {
			continue
		}
		// The page is full. It resumes inside this kind while the kind may still have
		// rows, and at the next kind otherwise.
		next := namespaceListCursor{Group: key.Group, Resource: key.Resource, After: after}
		if after == nil {
			if i+1 == len(keys) {
				return list, nil
			}
			next = namespaceListCursor{Group: keys[i+1].Group, Resource: keys[i+1].Resource}
		}
		token, err := encodeCursor(next)
		if err != nil {
			return nil, err
		}
		list.Continue = token
		return list, nil
	}
	return list, nil
}

// searchKind returns one page of a single kind, and the sort values to resume it
// after. A nil sort value means the kind had nothing more to return.
func (l *NamespaceListerFromSearch) searchKind(
	ctx context.Context,
	namespace string,
	key schema.GroupResource,
	filters []*resourcepb.Requirement,
	fields []string,
	limit int64,
	after []string,
	keep func(provisioning.ResourceListItem) bool,
) ([]provisioning.ResourceListItem, []string, error) {
	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Fields: filters,
		},
		Fields:       fields,
		Limit:        limit,
		SearchAfter:  after,
		SortBy:       []*resourcepb.ResourceSearchRequest_Sort{{Field: resource.SEARCH_FIELD_NAME}},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
	rsp, err := l.store.Search(ctx, req)
	if err != nil {
		return nil, nil, err
	}
	// Rows are read as field values. A server answering in another format would make
	// every kind look empty, which is an incomplete inventory reported as a complete one.
	if rsp.ResultFormat != resourcepb.ResourceSearchRequest_FIELD_VALUES {
		return nil, nil, fmt.Errorf("search for %s returned %s results, expected field values",
			key, rsp.ResultFormat)
	}
	if len(rsp.Rows) == 0 {
		return nil, nil, nil
	}

	items := make([]provisioning.ResourceListItem, 0, len(rsp.Rows))
	for _, row := range rsp.Rows {
		item, err := rowToItem(rsp.Fields, row, key)
		if err != nil {
			return nil, nil, err
		}
		if keep != nil && !keep(item) {
			continue
		}
		items = append(items, item)
	}
	// A short page means the kind is exhausted. A full one may or may not be, so it
	// is resumed; the extra request that finds nothing is the price of not guessing.
	if int64(len(rsp.Rows)) < limit {
		return items, nil, nil
	}
	return items, rsp.Rows[len(rsp.Rows)-1].SortFields, nil
}

func rowToItem(fields []*resourcepb.ResourceSearchField, row *resourcepb.ResourceSearchRow, key schema.GroupResource) (provisioning.ResourceListItem, error) {
	values, err := resource.DecodeSearchValues(fields, row)
	if err != nil {
		return provisioning.ResourceListItem{}, err
	}
	item := provisioning.ResourceListItem{
		Group:    key.Group,
		Resource: key.Resource,
		Name:     row.Key.GetName(),
		Title:    stringValue(values[resource.SEARCH_FIELD_TITLE]),
		Folder:   stringValue(values[resource.SEARCH_FIELD_FOLDER]),
	}
	kind := stringValue(values[resource.SEARCH_FIELD_MANAGER_KIND])
	identity := stringValue(values[resource.SEARCH_FIELD_MANAGER_ID])
	if kind == "" && identity == "" {
		return item, nil
	}
	item.Manager = &provisioning.ResourceManager{Kind: utils.ManagerKind(kind), Identity: identity}
	// The source sub-document is indexed whether or not a manager is, so an object
	// that kept its source annotations after losing its manager would otherwise
	// report a path for a repository that no longer owns it.
	item.Path = stringValue(values[resource.SEARCH_FIELD_SOURCE_PATH])
	item.Hash = stringValue(values[resource.SEARCH_FIELD_SOURCE_CHECKSUM])
	item.Time = int64Value(values[resource.SEARCH_FIELD_SOURCE_TIME])
	return item, nil
}

func stringValue(v any) string {
	s, _ := v.(string)
	return s
}

func int64Value(v any) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case float64:
		return int64(n)
	default:
		return 0
	}
}

// managerFilters compiles the manager selection into index requirements.
//
// "Managed" is a filter on the presence of a manager, which the index expresses as a
// whole-value regex: the empty expression matches an empty or missing value, and ".+"
// matches any value the field actually carries.
//
// GetManagerProperties treats an identity alone as managed, so unmanaged requires both
// manager fields to be empty: a row carrying an identity under an unrecognised kind must
// not be offered as something to take over. The managed side filters on the kind only,
// because requiring either field is a disjunction across two fields and the index
// requirements are conjunctive — such a row is therefore missing from managed rather
// than wrongly present in unmanaged.
func managerFilters(opts NamespaceListOptions) ([]*resourcepb.Requirement, error) {
	var filters []*resourcepb.Requirement
	if opts.ManagerKind != "" {
		filters = append(filters, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_MANAGER_KIND,
			Operator: string(selection.Equals),
			Values:   []string{opts.ManagerKind},
		})
	}
	if opts.ManagerID != "" {
		filters = append(filters, &resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_MANAGER_ID,
			Operator: string(selection.Equals),
			Values:   []string{opts.ManagerID},
		})
	}
	if opts.Managed == nil {
		return filters, nil
	}
	if !*opts.Managed && (opts.ManagerKind != "" || opts.ManagerID != "") {
		return nil, apierrors.NewBadRequest("managed=false cannot be combined with a manager filter")
	}
	// A manager kind already selects managed rows, so the presence filter would only
	// add a dictionary scan to the same answer.
	if *opts.Managed && opts.ManagerKind != "" {
		return filters, nil
	}
	return append(filters, emptyValueRequirement(resource.SEARCH_FIELD_MANAGER_KIND, !*opts.Managed)), nil
}

// unmanagedRow reports whether a row carries no manager at all. The index filter for
// managed=false can only ask that the manager kind be empty: asking the same of the
// identity means a whole-value regex, which enumerates the field's dictionary, and
// manager.id holds one term per manager — enough to trip the index's 10,000-term scan
// limit and fail the request outright. Low-cardinality kind is filtered in the index;
// identity is checked here, on the rows that come back.
func unmanagedRow(item provisioning.ResourceListItem) bool {
	return item.Manager == nil
}

// emptyValueRequirement matches rows whose field is empty or missing, or the complement.
func emptyValueRequirement(key string, empty bool) *resourcepb.Requirement {
	expression := ".+"
	if empty {
		expression = ""
	}
	return &resourcepb.Requirement{
		Key:      key,
		Operator: string(resource.OperatorRegex),
		Values:   []string{expression},
	}
}

// responseFields is the index projection behind the ResourceListItem projection: the
// narrow set every row carries, plus whatever the request opted in to.
func responseFields(selected sets.Set[string]) []string {
	fields := []string{
		resource.SEARCH_FIELD_TITLE,
		resource.SEARCH_FIELD_FOLDER,
		resource.SEARCH_FIELD_MANAGER_KIND,
		resource.SEARCH_FIELD_MANAGER_ID,
	}
	if selected.Has(FieldPath) {
		fields = append(fields, resource.SEARCH_FIELD_SOURCE_PATH)
	}
	if selected.Has(FieldHash) {
		fields = append(fields, resource.SEARCH_FIELD_SOURCE_CHECKSUM)
	}
	if selected.Has(FieldTime) {
		fields = append(fields, resource.SEARCH_FIELD_SOURCE_TIME)
	}
	return fields
}

// filterKeys narrows the registered kinds to the one a request named. A filter that
// names something else is refused rather than answered with an empty page: this
// endpoint lists the configured kinds and nothing else, so "no rows" and "not listed
// here" are different answers.
func filterKeys(keys []schema.GroupResource, group, kindResource string) ([]schema.GroupResource, error) {
	if group == "" && kindResource == "" {
		return keys, nil
	}
	out := make([]schema.GroupResource, 0, len(keys))
	for _, key := range keys {
		if group != "" && key.Group != group {
			continue
		}
		if kindResource != "" && key.Resource != kindResource {
			continue
		}
		out = append(out, key)
	}
	if len(out) == 0 {
		listed := make([]string, 0, len(keys))
		for _, key := range keys {
			listed = append(listed, key.String())
		}
		return nil, apierrors.NewBadRequest(fmt.Sprintf(
			"no provisionable resource matches group %q and resource %q; this namespace lists %s",
			group, kindResource, strings.Join(listed, ", ")))
	}
	return out, nil
}

// indexKeys returns the index keys of the kinds this endpoint lists, in a stable order
// so paging through them is repeatable.
//
// That is the active, served set: what SupportedResources reports, which is the
// configured kinds with collections expanded through discovery, minus the disabled
// declarations. Two kinds are deliberately absent.
//
// A disabled kind is declared but not acted on, so there is nothing to put under Git
// Sync and no reason to enumerate it. Resolving one is also a liability: a disabled
// declaration may name an API the instance does not install, and discovery then fails
// the whole request — including a request filtered to another kind, since the filter is
// applied to resolved keys.
//
// A collection member is absent because the index keys it by the group its objects are
// stored under, which is shared by every member: searching that key cannot tell a
// configured member from a sibling the configuration excludes, and the key is not the
// serving identity the repository-scoped list reports. Listing members needs the
// per-group API scan the repository-scoped lister does, not an index key; until this
// endpoint grows one, a filter naming a collection's storage group is refused by
// filterKeys rather than answered with its siblings.
//
// A member named directly in the configuration instead of through a wildcard is the one
// case this misses: nothing marks it as sharing storage, so it is listed under its
// serving group and finds nothing there. Collection membership is only knowable from a
// configured wildcard, so the place to refuse that configuration is where it is read.
func (l *NamespaceListerFromSearch) indexKeys(ctx context.Context, namespace string) ([]schema.GroupResource, error) {
	clients, err := l.clients.Clients(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("get clients: %w", err)
	}

	seen := sets.New[schema.GroupResource]()
	supported := clients.SupportedResources()
	keys := make([]schema.GroupResource, 0, len(supported))
	for _, r := range supported {
		if r.Collection != "" || provisioningresources.IsCollection(r.Group) {
			continue
		}
		_, gvr, err := clients.ForKind(ctx, r.WithVersion(""))
		if err != nil {
			return nil, fmt.Errorf("resolve %s: %w", r.GroupKind, err)
		}
		key := schema.GroupResource{Group: gvr.Group, Resource: gvr.Resource}
		if seen.Has(key) {
			continue
		}
		seen.Insert(key)
		keys = append(keys, key)
	}

	// Group first, then resource. GroupResource.String() is "resource.group", which
	// would order librarypanels.dashboard.grafana.app after folders.folder.grafana.app.
	slices.SortFunc(keys, func(a, b schema.GroupResource) int {
		if c := strings.Compare(a.Group, b.Group); c != 0 {
			return c
		}
		return strings.Compare(a.Resource, b.Resource)
	})
	return keys, nil
}
