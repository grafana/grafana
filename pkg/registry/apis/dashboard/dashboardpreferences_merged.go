package dashboard

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/validate/content"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

const (
	dashboardPreferencesMergedFolderParam      = "folder"
	dashboardPreferencesMergedIncludeUserParam = "includeUser"
)

func (b *DashboardsAPIBuilder) dashboardPreferencesMergedRoute() builder.APIRouteHandler {
	return builder.APIRouteHandler{
		Path: dashv2beta1.DashboardPreferencesResourceInfo.GetName() + "/" + dashboardPreferencesMergedName,
		Spec: &spec3.PathProps{
			Get: &spec3.Operation{
				OperationProps: spec3.OperationProps{
					OperationId: "getMergedDashboardPreferences",
					// The generated tier mutations invalidate this tag, so a tier write makes merged refetch.
					Tags:        []string{"DashboardPreferences"},
					Description: "Get the preferences a new dashboard in a folder starts from: each field from the highest tier that sets or resets it, and the tier it came from.",
					Parameters: []*spec3.Parameter{
						{
							ParameterProps: spec3.ParameterProps{
								Name:        "namespace",
								In:          "path",
								Required:    true,
								Example:     "default",
								Description: "workspace",
								Schema:      spec.StringProperty(),
							},
						},
						{
							ParameterProps: spec3.ParameterProps{
								Name:        dashboardPreferencesMergedFolderParam,
								In:          "query",
								Description: "UID of the folder the dashboard is created in. Omit it, or use general, for the top level.",
								Schema:      spec.StringProperty(),
							},
						},
						// The default is only in the description, so codegen keeps the argument optional.
						{
							ParameterProps: spec3.ParameterProps{
								Name:        dashboardPreferencesMergedIncludeUserParam,
								In:          "query",
								Description: "Whether the caller's own preferences apply. Defaults to true. False leaves them out, giving what any dashboard created in the folder starts from, the folder's own preferences included. To see what a folder inherits, pass its parent as folder.",
								Schema:      spec.BooleanProperty(),
							},
						},
					},
					Responses: &spec3.Responses{
						ResponsesProps: spec3.ResponsesProps{
							StatusCodeResponses: map[int]*spec3.Response{
								200: {
									ResponseProps: spec3.ResponseProps{
										Description: "The merged preferences",
										Content: map[string]*spec3.MediaType{
											"application/json": {
												MediaTypeProps: spec3.MediaTypeProps{
													Schema: spec.RefSchema("#/components/schemas/" + dashv2beta1.DashboardPreferencesMerged{}.OpenAPIModelName()),
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		Handler: b.handleMergedDashboardPreferences,
		Schemas: dashboardPreferencesMergedSchemas(),
	}
}

func (b *DashboardsAPIBuilder) handleMergedDashboardPreferences(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	query := r.URL.Query()

	includeUser := true
	if raw := query.Get(dashboardPreferencesMergedIncludeUserParam); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			errhttp.Write(ctx, apierrors.NewBadRequest("includeUser must be true or false"), w)
			return
		}
		includeUser = parsed
	}

	store := b.dashboardPreferencesStorage
	if store == nil {
		errhttp.Write(ctx, apierrors.NewServiceUnavailable("dashboard preferences are not available"), w)
		return
	}

	merged, err := store.merged(ctx, query.Get(dashboardPreferencesMergedFolderParam), includeUser)
	if err != nil {
		errhttp.Write(ctx, dashboardPreferencesMergedPublicError(err), w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(merged)
}

// errhttp.Write finds a status anywhere in an error's chain, and an accessCheckError's cause can be the access
// backend's own status, whose message can carry datastore details.
func dashboardPreferencesMergedPublicError(err error) error {
	if ace, ok := errors.AsType[*accessCheckError](err); ok {
		return apierrors.NewInternalError(errors.New(ace.Error()))
	}
	return err
}

// The OpenAPI builder adds only the components that the kind's own routes reach, so the route brings its
// response types. Its copies of the kind's components lose to the published ones (first writer wins).
var dashboardPreferencesMergedSchemas = sync.OnceValue(func() map[string]spec.Schema {
	return builder.RouteSchemas(dashv2beta1.GetOpenAPIDefinitions, dashv2beta1.DashboardPreferencesMerged{}.OpenAPIModelName())
})

// Every field a tier can set or reset. TestDashboardPreferencesFieldPathsMatchSchema keeps it in step with the
// schema's reset paths.
var dashboardPreferencesFieldPaths = []dashv2beta1.DashboardPreferencesResetPath{
	dashv2beta1.DashboardPreferencesResetPathDashboardPreload,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoRefresh,
	dashv2beta1.DashboardPreferencesResetPathDashboardAutoRefreshIntervals,
	dashv2beta1.DashboardPreferencesResetPathDashboardTimeRange,
	dashv2beta1.DashboardPreferencesResetPathDashboardCursorSync,
	dashv2beta1.DashboardPreferencesResetPathPanelsLegendShowLegend,
	dashv2beta1.DashboardPreferencesResetPathPanelsLegendPlacement,
	dashv2beta1.DashboardPreferencesResetPathPanelsLegendDisplayMode,
	dashv2beta1.DashboardPreferencesResetPathPanelsTooltipMode,
	dashv2beta1.DashboardPreferencesResetPathPanelsTooltipSort,
	dashv2beta1.DashboardPreferencesResetPathPanelsTooltipHideZeros,
	dashv2beta1.DashboardPreferencesResetPathPanelsFieldDecimals,
}

// dashboardPreferencesMergeTier is one stored tier, in the order a merge consults them.
type dashboardPreferencesMergeTier struct {
	tier dashboardPreferencesTier
	// Left out of sources when empty.
	name string
	spec dashv2beta1.DashboardPreferencesSpec
}

// tiers are in descending priority. Each field comes from the first tier that sets or resets it, where set means
// what it means to admission: the field is present in the encoded spec.
func mergeDashboardPreferences(tiers []dashboardPreferencesMergeTier) (*dashv2beta1.DashboardPreferencesMerged, error) {
	encoded := make([]any, len(tiers))
	for i, t := range tiers {
		spec := t.spec
		spec.Reset = nil
		raw, err := json.Marshal(spec)
		if err != nil {
			return nil, fmt.Errorf("error marshaling dashboard preferences spec: %w", err)
		}
		// Numbers stay json.Number, so an integer is written back exactly.
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.UseNumber()
		if err = decoder.Decode(&encoded[i]); err != nil {
			return nil, fmt.Errorf("error decoding dashboard preferences spec: %w", err)
		}
	}

	values := map[string]any{}
	sources := map[string]dashv2beta1.DashboardPreferencesMergedSource{}
	for _, path := range dashboardPreferencesFieldPaths {
		for i, t := range tiers {
			reset := slices.Contains(t.spec.Reset, path)
			value, set := dashboardPreferencesFieldValue(encoded[i], string(path))
			if !reset && !set {
				continue
			}
			// Validation keeps a tier from both setting and resetting a field. If a stored tier does both,
			// the reset wins, because a reset field is absent from the merged spec.
			if !reset {
				setDashboardPreferencesField(values, string(path), value)
			}
			sources[string(path)] = dashv2beta1.DashboardPreferencesMergedSource{
				Tier:  dashv2beta1.DashboardPreferencesMergedTier(t.tier),
				Name:  t.name,
				Reset: reset,
			}
			break
		}
	}

	merged := &dashv2beta1.DashboardPreferencesMerged{
		TypeMeta: metav1.TypeMeta{APIVersion: dashv2beta1.APIVERSION, Kind: dashv2beta1.DashboardPreferencesMergedKind},
		Sources:  sources,
	}
	raw, err := json.Marshal(values)
	if err != nil {
		return nil, fmt.Errorf("error marshaling merged dashboard preferences spec: %w", err)
	}
	if err = json.Unmarshal(raw, &merged.Spec); err != nil {
		return nil, fmt.Errorf("error decoding merged dashboard preferences spec: %w", err)
	}
	return merged, nil
}

// setDashboardPreferencesField creates parent objects only when it writes, so a field that no tier sets leaves no
// empty object behind.
func setDashboardPreferencesField(values map[string]any, path string, value any) {
	keys := strings.Split(path, ".")
	obj := values
	for _, key := range keys[:len(keys)-1] {
		child, ok := obj[key].(map[string]any)
		if !ok {
			child = map[string]any{}
			obj[key] = child
		}
		obj = child
	}
	obj[keys[len(keys)-1]] = value
}

func (s *dashboardPreferencesStorage) merged(ctx context.Context, folderUID string, includeUser bool) (*dashv2beta1.DashboardPreferencesMerged, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting requester: %w", err)
	}
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	folderUIDs, err := s.mergedFolders(ctx, requester, nsInfo, folderUID)
	if err != nil {
		return nil, err
	}

	names := make([]string, 0, len(folderUIDs)+2)
	// The authorizer let the caller read the org tier, which takes membership of this namespace, so the
	// caller's own tier passes the user tier's rule.
	if includeUser && requester.IsIdentityType(authlib.TypeUser) {
		names = append(names, dashv2beta1.DashboardPreferencesUserName(requester.GetIdentifier()))
	}
	for _, uid := range folderUIDs {
		names = append(names, dashv2beta1.DashboardPreferencesFolderName(uid))
	}
	names = append(names, dashv2beta1.DashboardPreferencesOrgName)
	// Storage can't hold a name that isn't a scope, such as one with an empty identifier or an odd ancestor
	// UID, so it isn't read.
	names = slices.DeleteFunc(names, func(name string) bool {
		_, ok := dashboardPreferencesScopeFromName(name)
		return !ok
	})

	stored, err := s.getStoredTiers(ctx, names)
	if err != nil {
		return nil, err
	}
	// The mutation hook strips finalizers on every write, so no tier waits in deletion today; this keeps one
	// that ever does from applying.
	stored = slices.DeleteFunc(stored, func(item dashv2beta1.DashboardPreferences) bool {
		return item.DeletionTimestamp != nil
	})

	hidden, err := s.unreadableAncestorTiers(ctx, requester, nsInfo.Value, folderUIDs, stored)
	if err != nil {
		return nil, err
	}

	tiers := make([]dashboardPreferencesMergeTier, 0, len(stored))
	for _, item := range stored {
		scope, _ := dashboardPreferencesScopeFromName(item.Name)
		name := item.Name
		if hidden[item.Name] {
			name = ""
		}
		tiers = append(tiers, dashboardPreferencesMergeTier{tier: scope.Tier, name: name, spec: item.Spec})
	}
	return mergeDashboardPreferences(tiers)
}

// mergedFolders returns the folder and its ancestors, nearest first, or nothing for the top level.
func (s *dashboardPreferencesStorage) mergedFolders(ctx context.Context, requester identity.Requester, nsInfo authlib.NamespaceInfo, folderUID string) ([]string, error) {
	// The top level has only the org tier, whose read rule the authorizer already applied.
	if folder.IsRootFolderUID(folderUID) {
		return nil, nil
	}
	// The dynamic client refuses . and .. as names before sending anything, although tier names allow them.
	if _, ok := dashboardPreferencesScopeFromName(dashv2beta1.DashboardPreferencesFolderName(folderUID)); !ok || len(content.IsPathSegmentName(folderUID)) > 0 {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("folder %q can't hold dashboards", folderUID))
	}

	// Checked before anything reads the folder, so a caller who can't read it can't tell whether it exists.
	allowed, err := checkDashboardPreferencesFolderAccess(ctx, s.accessClient, requester, nsInfo.Value, folderUID, utils.VerbGet)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, apierrors.NewForbidden(folders.FolderResourceInfo.GroupResource(), folderUID, folder.ErrAccessDenied)
	}

	if s.folders == nil {
		return nil, fmt.Errorf("folder client provider is not configured")
	}
	folderClient := s.folders.GetOrCreateHandler(nsInfo.Value)
	if folderClient == nil {
		return nil, fmt.Errorf("folder client handler is not configured for namespace %q", nsInfo.Value)
	}
	// Parent folders apply whether or not the caller can read them, so everyone creating in a folder starts
	// from the same values. Only these folder reads are elevated. The org is the namespace's:
	// WithServiceIdentityForSingleNamespace claims org 1 in every org.
	svcCtx := identity.WithServiceIdentityContext(ctx, nsInfo.OrgID, func(id *identity.StaticRequester) { id.Namespace = nsInfo.Value })

	foldersGR := folders.FolderResourceInfo.GroupResource()
	obj, err := folderClient.Get(svcCtx, folderUID, nsInfo.OrgID, metav1.GetOptions{}, "parents")
	if isNotFoundForObject(err, foldersGR, folderUID) {
		return nil, apierrors.NewNotFound(foldersGR, folderUID)
	}
	if err != nil {
		return nil, dashboardPreferencesAncestryError(ctx, nsInfo.Value, folderUID, err)
	}

	var list folders.FolderInfoList
	if err = runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &list); err != nil {
		return nil, dashboardPreferencesAncestryError(ctx, nsInfo.Value, folderUID, fmt.Errorf("error decoding folder parents: %w", err))
	}
	items := list.Items
	if len(items) == 0 || items[len(items)-1].Name != folderUID {
		return nil, dashboardPreferencesAncestryError(ctx, nsInfo.Value, folderUID, errors.New("folder parents don't end with the folder"))
	}

	// The folder API ends the walk at a parent it couldn't read, for any error. Reading it again tells a missing
	// parent, where the ancestry ends, from a failure that would drop the rest of it.
	if items[0].Detached {
		_, err = folderClient.Get(svcCtx, items[0].Name, nsInfo.OrgID, metav1.GetOptions{})
		if !isNotFoundForObject(err, foldersGR, items[0].Name) {
			if err == nil {
				err = fmt.Errorf("detached parent folder %q was read on a second attempt", items[0].Name)
			} else {
				err = fmt.Errorf("error reading detached parent folder %q: %w", items[0].Name, err)
			}
			return nil, dashboardPreferencesAncestryError(ctx, nsInfo.Value, folderUID, err)
		}
		items = items[1:]
	}

	folderUIDs := make([]string, 0, len(items))
	for _, item := range slices.Backward(items) {
		folderUIDs = append(folderUIDs, item.Name)
	}
	return folderUIDs, nil
}

// The apiserver sends an error's text to the client, so the folder API's message stays in the log. A refusal of
// the service identity is not a 403, because the caller can read the folder, and walking as the caller would
// silently leave out the parents it can't read.
func dashboardPreferencesAncestryError(ctx context.Context, namespace, folderUID string, err error) error {
	logging.FromContext(ctx).Error("dashboard preferences failed to read folder ancestry",
		"namespace", namespace, "folder", folderUID, "err", err)
	return apierrors.NewInternalError(errors.New("folder ancestry could not be read"))
}

// Parent folders apply whether or not the caller can read them, but sources names only those it can read.
func (s *dashboardPreferencesStorage) unreadableAncestorTiers(ctx context.Context, requester identity.Requester, namespace string, folderUIDs []string, stored []dashv2beta1.DashboardPreferences) (map[string]bool, error) {
	// The first folder is the target, which mergedFolders already required the caller to read.
	ancestors := map[string]bool{}
	if len(folderUIDs) > 1 {
		for _, folderUID := range folderUIDs[1:] {
			ancestors[dashv2beta1.DashboardPreferencesFolderName(folderUID)] = true
		}
	}
	var items []dashv2beta1.DashboardPreferences
	hidden := map[string]bool{}
	for _, item := range stored {
		if ancestors[item.Name] {
			items = append(items, item)
			hidden[item.Name] = true
		}
	}
	if len(items) == 0 {
		return nil, nil
	}

	// mergedFolders checked the target with the same client and namespace, so this only keeps a nil client
	// from being called.
	if !s.canCheckFolderAccess(requester, namespace) {
		return hidden, nil
	}
	readable, err := s.readableFolderTier(ctx, namespace, items)
	if err != nil {
		return nil, err
	}
	for _, item := range readable {
		delete(hidden, item.Name)
	}
	return hidden, nil
}
