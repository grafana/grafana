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
			// The kind the page stopped in is no longer listed, so there is nothing
			// left to resume: a token cannot be rewritten into a different kind.
			return &provisioning.ResourceList{Items: []provisioning.ResourceListItem{}}, nil
		}
		keys = keys[start:]
	}

	list := &provisioning.ResourceList{Items: make([]provisioning.ResourceListItem, 0, limit)}
	after := cursor.After
	for i, key := range keys {
		for int64(len(list.Items)) < limit {
			rows, sortFields, err := l.searchKind(ctx, namespace, key, filters, fields, limit-int64(len(list.Items)), after)
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
	if rsp.Error != nil {
		return nil, nil, resource.GRPCStatusError(rsp.Error)
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
		Path:     stringValue(values[resource.SEARCH_FIELD_SOURCE_PATH]),
		Hash:     stringValue(values[resource.SEARCH_FIELD_SOURCE_CHECKSUM]),
		Time:     int64Value(values[resource.SEARCH_FIELD_SOURCE_TIME]),
	}
	if kind := stringValue(values[resource.SEARCH_FIELD_MANAGER_KIND]); kind != "" {
		item.Manager = &provisioning.ResourceManager{
			Kind:     utils.ManagerKind(kind),
			Identity: stringValue(values[resource.SEARCH_FIELD_MANAGER_ID]),
		}
	}
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
	expression := ""
	if *opts.Managed {
		expression = ".+"
	}
	return append(filters, &resourcepb.Requirement{
		Key:      resource.SEARCH_FIELD_MANAGER_KIND,
		Operator: string(resource.OperatorRegex),
		Values:   []string{expression},
	}), nil
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

// indexKeys returns the index keys of the configured kinds, in a stable order so
// paging through them is repeatable.
//
// A collection's members are keyed by the group their objects are stored under, not by
// the group that serves each one — the same key stats counts them under, so the two
// agree kind for kind.
func (l *NamespaceListerFromSearch) indexKeys(ctx context.Context, namespace string) ([]schema.GroupResource, error) {
	clients, err := l.clients.Clients(ctx, namespace)
	if err != nil {
		return nil, fmt.Errorf("get clients: %w", err)
	}

	// The served set expands collections into their members; the configured set adds
	// back the kinds the pipeline is not acting on, which are still in the namespace.
	resolve := make([]SupportedResource, 0, len(l.configured))
	resolved := sets.New[schema.GroupKind]()
	for _, r := range slices.Concat(clients.SupportedResources(), l.configured) {
		if provisioningresources.IsCollection(r.Group) || resolved.Has(r.GroupKind) {
			continue
		}
		resolved.Insert(r.GroupKind)
		resolve = append(resolve, r)
	}

	seen := sets.New[schema.GroupResource]()
	keys := make([]schema.GroupResource, 0, len(resolve))
	for _, r := range resolve {
		_, gvr, err := clients.ForKind(ctx, r.WithVersion(""))
		if err != nil {
			return nil, fmt.Errorf("resolve %s: %w", r.GroupKind, err)
		}
		key := schema.GroupResource{Group: gvr.Group, Resource: gvr.Resource}
		if r.Collection != "" {
			key.Group = r.Collection
		}
		if seen.Has(key) {
			continue
		}
		seen.Insert(key)
		keys = append(keys, key)
	}

	slices.SortFunc(keys, func(a, b schema.GroupResource) int {
		return strings.Compare(a.String(), b.String())
	})
	return keys, nil
}
