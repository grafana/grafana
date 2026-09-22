package rules

import (
	"context"
	"errors"
	"fmt"
	"io"

	restclient "k8s.io/client-go/rest"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"

	alertingv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	rulesManifest "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/manifestdata"
	rulesApp "github.com/grafana/grafana/apps/alerting/rules/pkg/app"
	rulesAppConfig "github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	rulesequence_app "github.com/grafana/grafana/apps/alerting/rules/pkg/app/rulesequence"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/config"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/rulesequence"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/search"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	searchauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	reqns "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/rulesync"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	apistore "github.com/grafana/grafana/pkg/storage/unified/apistore"
	unifiedresource "github.com/grafana/grafana/pkg/storage/unified/resource"
)

var (
	_ appsdkapiserver.AppInstaller        = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider     = (*AppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider  = (*AppInstaller)(nil)
	_ appinstaller.LegacyStatusProvider   = (*AppInstaller)(nil)
	_ appinstaller.StorageOptionsProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	appsdkapiserver.AppInstaller
	cfg *setting.Cfg
	ng  *ngalert.AlertNG
}

func RegisterAppInstaller(
	cfg *setting.Cfg,
	ng *ngalert.AlertNG,
	unifiedClient unifiedresource.ResourceClient,
	dual dualwrite.Service,
	_ resource.ClientGenerator, // retained for Wire compatibility; membership resolution now uses a watch-backed index
) (*AppInstaller, error) {
	if ng.IsDisabled() {
		log.New("app-registry").Info("Skipping Kubernetes Alerting Rules apiserver (rules.alerting.grafana.app): Unified Alerting is disabled")
		return nil, nil
	}

	installer := &AppInstaller{
		cfg: cfg,
		ng:  ng,
	}

	membershipIndex := rulesequence_app.NewMembershipIndex()

	// Search routes through a dual-writer-aware client per kind: the legacy
	// backend (provisioning service) serves modes 0-3, the unified client 4+.
	legacySearch := search.NewLegacyClient(*ng.Api.AlertRules)
	searchAdapter := dualwrite.NewSearchAdapter(dual)
	searchHandler := search.NewHandler(
		unifiedresource.NewSearchClient(searchAdapter, alertrule.ResourceInfo.GroupResource(), unifiedClient, legacySearch),
		unifiedresource.NewSearchClient(searchAdapter, recordingrule.ResourceInfo.GroupResource(), unifiedClient, legacySearch),
	)

	appSpecificConfig := rulesAppConfig.RuntimeConfig{
		FolderValidator:                  newFolderValidator(ng),
		BaseEvaluationInterval:           ng.Cfg.UnifiedAlerting.BaseInterval,
		ReservedLabelKeys:                ngmodels.LabelsUserCannotSpecify,
		ResolveRuleRef:                   newRuleRefResolver(ng),
		MembershipResolver:               membershipIndex,
		NotificationSettingsValidator:    newNotificationSettingsValidator(ng),
		WatchNamespace:                   watchNamespace(cfg),
		SearchRulesHandler:               search.WithAPIStatusErrorResponse(searchHandler.SearchRules),
		SearchAlertRulesHandler:          search.WithAPIStatusErrorResponse(searchHandler.SearchAlertRules),
		SearchRecordingRulesHandler:      search.WithAPIStatusErrorResponse(searchHandler.SearchRecordingRules),
		CheckExternalRulerSyncDatasource: newExternalRulerSyncDatasourceChecker(cfg, ng.DataSourceService, ng.Api.AccessControl),
	}

	provider := simple.NewAppProvider(rulesManifest.LocalManifest(), appSpecificConfig, rulesApp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *rulesManifest.LocalManifest().ManifestData,
		SpecificConfig: appSpecificConfig,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, rulesManifest.NewGoTypeAssociator())
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

// Rejects writes while the operator ini override is set, then verifies both
// that the caller can read the datasource and that it's statically eligible
// (rulesync.IsRulerCandidate) as an external ruler sync source. Deliberately
// does NOT probe the ruler config API: that's a network call, expensive to
// run on every admission request, and -- combined with a missing access
// check -- was exploitable as a way to probe for datasources the caller
// can't see. Whether the ruler config API is actually reachable is verified
// by the sync loop instead and reflected in Config.status (see SyncOrg).
func newExternalRulerSyncDatasourceChecker(cfg *setting.Cfg, ds datasources.DataSourceService, ac accesscontrol.AccessControl) func(ctx context.Context, uid string) error {
	return func(ctx context.Context, uid string) error {
		if cfg == nil {
			return fmt.Errorf("server configuration unavailable; cannot verify operator override")
		}
		if cfg.UnifiedAlerting.ExternalRulerUID != "" {
			return fmt.Errorf("external ruler UID is managed by the operator (unified_alerting.external_ruler_uid); cannot be changed via API")
		}

		ns, err := reqns.NamespaceInfoFrom(ctx, true)
		if err != nil {
			return fmt.Errorf("resolve org from request namespace: %w", err)
		}

		user, err := identity.GetRequester(ctx)
		if err != nil {
			return fmt.Errorf("resolve requester: %w", err)
		}
		// Checked before GetDataSource, and denial is reported identically to
		// not-found below, so this can't be used to probe for the existence of a
		// datasource the caller has no access to.
		scope := datasources.ScopeProvider.GetResourceScopeUID(uid)
		hasAccess, err := ac.Evaluate(ctx, user, accesscontrol.EvalPermission(datasources.ActionRead, scope))
		if err != nil {
			return fmt.Errorf("check datasource access: %w", err)
		}
		if !hasAccess {
			return fmt.Errorf("datasource not found")
		}

		got, err := ds.GetDataSource(ctx, &datasources.GetDataSourceQuery{UID: uid, OrgID: ns.OrgID})
		if err != nil {
			if errors.Is(err, datasources.ErrDataSourceNotFound) {
				return fmt.Errorf("datasource not found")
			}
			return fmt.Errorf("look up datasource: %w", err)
		}
		return rulesync.IsRulerCandidate(got)
	}
}

// watchNamespace returns the namespace the RuleSequence informer should watch.
// In cloud each instance serves one stack namespace and its storage identity is
// scoped to it, so an all-namespace watch is rejected as a mismatch; on-prem
// (no stack ID) returns "" to watch all namespaces.
func watchNamespace(cfg *setting.Cfg) string {
	if cfg == nil || cfg.StackID == "" {
		return ""
	}
	// The cloud mapper ignores the org ID and returns the stack namespace.
	return reqns.GetNamespaceMapper(cfg)(0)
}

func resolveOrgID(ctx context.Context) int64 {
	orgID, err := reqns.OrgIDForList(ctx)
	if err != nil || orgID < 1 {
		if user, _ := identity.GetRequester(ctx); user != nil {
			orgID = user.GetOrgID()
		}
	}
	return orgID
}

// newFolderValidator returns a callback that validates folder existence using the folder service.
func newFolderValidator(ng *ngalert.AlertNG) func(ctx context.Context, folderUID string) (bool, error) {
	return func(ctx context.Context, folderUID string) (bool, error) {
		if folder.IsRootFolderUID(folderUID) {
			return false, nil
		}
		orgID := resolveOrgID(ctx)
		user, _ := identity.GetRequester(ctx)
		if user == nil || orgID < 1 {
			// If we can't resolve identity/org in this context, don't block creation based on existence
			return true, nil
		}
		_, err := ng.Api.RuleStore.GetNamespaceByUID(ctx, folderUID, orgID, user)
		if err != nil {
			return false, nil
		}
		return true, nil
	}
}

// newRuleRefResolver returns a callback that resolves rule references using the legacy RuleStore.
//
// TODO: ResolveRuleRef currently uses the legacy RuleStore (GetAlertRuleByUID).
// In the legacy model, both alert rules and recording rules live in the same
// alert_rule table, so this query covers both rule types referenced by a RuleSequence.
// When alert/recording rules move to k8s-native storage, this callback will need
// to switch to a k8s client lookup (or be replaced by an informer-based resolver).
func newRuleRefResolver(ng *ngalert.AlertNG) func(ctx context.Context, uid string) (rulesAppConfig.RuleRef, bool, error) {
	return func(ctx context.Context, uid string) (rulesAppConfig.RuleRef, bool, error) {
		orgID := resolveOrgID(ctx)
		if orgID < 1 {
			return rulesAppConfig.RuleRef{}, false, errors.New("could not resolve org ID")
		}

		r, err := ng.Api.RuleStore.GetAlertRuleByUID(ctx, &ngmodels.GetAlertRuleByUIDQuery{OrgID: orgID, UID: uid})
		if err != nil {
			if errors.Is(err, ngmodels.ErrAlertRuleNotFound) {
				return rulesAppConfig.RuleRef{}, false, nil
			}
			return rulesAppConfig.RuleRef{}, false, err
		}

		return rulesAppConfig.RuleRef{UID: r.UID, FolderUID: r.NamespaceUID}, true, nil
	}
}

// newNotificationSettingsValidator returns a callback that validates notification
// receiver configuration against the Alertmanager config.
func newNotificationSettingsValidator(ng *ngalert.AlertNG) func(ctx context.Context, ns alertingv0alpha1.AlertRuleNotificationSettings) error {
	return func(ctx context.Context, ns alertingv0alpha1.AlertRuleNotificationSettings) error {
		if err := validateNotificationSettingsFields(ns); err != nil {
			return err
		}

		orgID := resolveOrgID(ctx)
		if orgID < 1 {
			// Without org context, skip validation rather than block
			return nil
		}
		provider := notifier.NewCachedNotificationSettingsValidationService(ng.Api.AlertingStore)
		vd, err := provider.Validator(ctx, orgID)
		if err != nil {
			log.New("alerting.rules.app").Error("failed to create notification settings validator", "error", err)
			// If we cannot build a validator, don't block admission
			return nil
		}

		settingsModel, err := alertrule.ConvertNotificationSettings(&ns)
		if err != nil {
			return err
		}
		return vd.Validate(settingsModel)
	}
}

func validateNotificationSettingsFields(ns alertingv0alpha1.AlertRuleNotificationSettings) error {
	if ns.SimplifiedRouting != nil && ns.SimplifiedRouting.Receiver == "" {
		return errors.New("receiver is empty")
	}
	if ns.NamedRoutingTree != nil && ns.NamedRoutingTree.RoutingTree == "" {
		return errors.New("routing tree is empty")
	}
	if ns.NamedRoutingTree == nil && ns.SimplifiedRouting == nil {
		return errors.New("empty notification settings")
	}
	return nil
}

func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	authz := a.ng.Api.AccessControl
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			attr = ruleSearchReadAttributes(attr)
			switch attr.GetResource() {
			case recordingrule.ResourceInfo.GroupResource().Resource:
				return recordingrule.Authorize(ctx, authz, attr)
			case alertrule.ResourceInfo.GroupResource().Resource:
				return alertrule.Authorize(ctx, authz, attr)
			case rulesequence.ResourceInfo.GroupResource().Resource:
				return rulesequence.Authorize(ctx, authz, attr)
			case search.RouteResource:
				return search.Authorize(ctx, authz, attr)
			case config.ResourceInfo.GroupResource().Resource:
				return config.Authorize(ctx, authz, attr)
			}
			return authorizer.DecisionNoOpinion, "", nil
		},
	)
}

// ruleSearchReadAttributes restates the compatibility POST as the list it
// performs. Kubernetes parses /{resource}/searchRules as a create of an object
// named searchRules, which would otherwise require rule-create permission.
func ruleSearchReadAttributes(attr authorizer.Attributes) authorizer.Attributes {
	resourceName := attr.GetResource()
	isRule := resourceName == alertrule.ResourceInfo.GroupResource().Resource || resourceName == recordingrule.ResourceInfo.GroupResource().Resource
	if isRule && attr.IsResourceRequest() && attr.GetVerb() == "create" && attr.GetName() == search.RouteResource && attr.GetSubresource() == "" {
		return searchauthorizer.AsReadAttributes(attr)
	}
	return attr
}

func (a *AppInstaller) AdmissionPlugin() admission.Factory {
	inner := a.AppInstaller.AdmissionPlugin()
	if inner == nil {
		return nil
	}

	return func(r io.Reader) (admission.Interface, error) {
		plugin, err := inner(r)
		if err != nil {
			return nil, err
		}

		return resourceOnlyAdmissionHook{plugin}, nil
	}
}

type resourceOnlyAdmissionHook struct{ admission.Interface }

func (s resourceOnlyAdmissionHook) Admit(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	m, ok := s.Interface.(admission.MutationInterface)
	if !ok || a.GetSubresource() != "" {
		return nil
	}

	return m.Admit(ctx, a, o)
}

func (s resourceOnlyAdmissionHook) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	m, ok := s.Interface.(admission.ValidationInterface)
	if !ok || a.GetSubresource() != "" {
		return nil
	}

	return m.Validate(ctx, a, o)
}

func (a *AppInstaller) GetStorageOptions(gr schema.GroupResource) *apistore.StorageOptions {
	// Config is a per-org singleton with no folder concept; the rules-app
	// group's other kinds (AlertRule, RecordingRule, RuleSequence) all live in
	// folders, so this must be scoped per-kind rather than blanket-true.
	if gr == config.ResourceInfo.GroupResource() {
		return &apistore.StorageOptions{}
	}
	return &apistore.StorageOptions{
		EnableFolderSupport: true,
	}
}

func (a *AppInstaller) GetLegacyStorage(gvr schema.GroupVersionResource) grafanarest.Storage {
	namespacer := reqns.GetNamespaceMapper(a.cfg)
	switch gvr {
	case recordingrule.ResourceInfo.GroupVersionResource():
		return recordingrule.NewStorage(*a.ng.Api.AlertRules, namespacer)
	case alertrule.ResourceInfo.GroupVersionResource():
		return alertrule.NewStorage(*a.ng.Api.AlertRules, namespacer)
	case rulesequence.ResourceInfo.GroupVersionResource():
		return nil
	case config.ResourceInfo.GroupVersionResource():
		// Config has no legacy backend — returning nil makes the apiserver serve
		// it directly from unified storage (no dual writer).
		return nil
	default:
		panic("unknown legacy storage requested: " + gvr.String())
	}
}

// GetLegacyStatus wires the /status subresource for the legacy-storage-backed rule
// kinds. Without this, the app-sdk-generated StatusREST is silently dropped for
// legacy/dual-write parents. The rule status is persisted to alert_rule.k8s_status
// via the shared rule store.
func (a *AppInstaller) GetLegacyStatus(gvr schema.GroupVersionResource, unified *appsdkapiserver.StatusREST) rest.Storage {
	namespacer := reqns.GetNamespaceMapper(a.cfg)
	switch gvr {
	case recordingrule.ResourceInfo.GroupVersionResource():
		return recordingrule.NewStatusStorage(*a.ng.Api.AlertRules, namespacer, a.ng.Api.RuleStore, unified)
	case alertrule.ResourceInfo.GroupVersionResource():
		return alertrule.NewStatusStorage(*a.ng.Api.AlertRules, namespacer, a.ng.Api.RuleStore, unified)
	default:
		return nil
	}
}
