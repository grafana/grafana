package rules

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"k8s.io/apiserver/pkg/endpoints/request"
	restclient "k8s.io/client-go/rest"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis"
	alertingv0alpha1 "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	rulesApp "github.com/grafana/grafana/apps/alerting/rules/pkg/app"
	rulesAppConfig "github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/alertrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/recordingrule"
	"github.com/grafana/grafana/pkg/registry/apps/alerting/rules/rulechain"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	reqns "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/setting"
	apistore "github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var (
	_ appsdkapiserver.AppInstaller        = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider     = (*AppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider  = (*AppInstaller)(nil)
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
	clientGenerator resource.ClientGenerator,
) (*AppInstaller, error) {
	if ng.IsDisabled() {
		log.New("app-registry").Info("Skipping Kubernetes Alerting Rules apiserver (rules.alerting.grafana.app): Unified Alerting is disabled")
		return nil, nil
	}

	installer := &AppInstaller{
		cfg: cfg,
		ng:  ng,
	}

	namespacer := reqns.GetNamespaceMapper(cfg)

	// The clientGenerator blocks until the apiserver is ready, so calling it
	// during registration would deadlock. Create the client lazily on first
	// admission request. Uses mutex+nil-check so transient failures are
	// retried on the next request.
	var (
		ruleChainClient   *alertingv0alpha1.RuleChainClient
		ruleChainClientMu sync.Mutex
	)
	getRuleChainClient := func() (*alertingv0alpha1.RuleChainClient, error) {
		ruleChainClientMu.Lock()
		defer ruleChainClientMu.Unlock()
		if ruleChainClient != nil {
			return ruleChainClient, nil
		}
		c, err := alertingv0alpha1.NewRuleChainClientFromGenerator(clientGenerator)
		if err != nil {
			return nil, err
		}
		ruleChainClient = c
		return ruleChainClient, nil
	}

	resolveNamespace := func(ctx context.Context) (string, error) {
		namespace := request.NamespaceValue(ctx)
		if namespace != "" {
			return namespace, nil
		}
		orgID, err := reqns.OrgIDForList(ctx)
		if err == nil && orgID > 0 {
			return namespacer(orgID), nil
		}
		if user, _ := identity.GetRequester(ctx); user != nil && user.GetOrgID() > 0 {
			return namespacer(user.GetOrgID()), nil
		}
		return "", errors.New("could not resolve namespace")
	}

	// Used by RuleChain CREATE/UPDATE admission validation so all referenced rule UIDs
	// are checked with a single RuleChain list/scan.
	//
	// TODO: This performs an O(N) full list of all RuleChains and scans every ref.
	// It also has a TOCTOU race: another concurrent admission could assign the same
	// UID between our list and the final persist. At low chain/rule counts this is
	// acceptable. Consider adding optimistic locking, a label-based index, or an
	// informer cache in PR 2 / future work to make membership lookups O(1).
	resolveRuleChainMemberships := func(ctx context.Context, uids []string) (map[string]rulesAppConfig.RuleChainMembership, error) {
		memberships := make(map[string]rulesAppConfig.RuleChainMembership, len(uids))
		if len(uids) == 0 {
			return memberships, nil
		}

		namespace, err := resolveNamespace(ctx)
		if err != nil {
			return nil, err
		}

		targets := make(map[string]struct{}, len(uids))
		for _, uid := range uids {
			if uid == "" {
				continue
			}
			targets[uid] = struct{}{}
			memberships[uid] = rulesAppConfig.RuleChainMembership{}
		}

		if len(targets) == 0 {
			return memberships, nil
		}

		client, err := getRuleChainClient()
		if err != nil {
			return nil, fmt.Errorf("initializing rule chain client: %w", err)
		}
		chains, err := client.ListAll(ctx, namespace, resource.ListOptions{})
		if err != nil {
			return nil, err
		}

		remaining := len(targets)
		for _, chain := range chains.Items {
			for _, ref := range chain.Spec.RecordingRules {
				uid := string(ref.Uid)
				if _, ok := targets[uid]; ok {
					memberships[uid] = rulesAppConfig.RuleChainMembership{ChainUID: chain.Name, Found: true}
					delete(targets, uid)
					remaining--
				}
			}
			for _, ref := range chain.Spec.AlertingRules {
				uid := string(ref.Uid)
				if _, ok := targets[uid]; ok {
					memberships[uid] = rulesAppConfig.RuleChainMembership{ChainUID: chain.Name, Found: true}
					delete(targets, uid)
					remaining--
				}
			}
			if remaining == 0 {
				break
			}
		}

		return memberships, nil
	}

	appSpecificConfig := rulesAppConfig.RuntimeConfig{
		// Validate folder existence using the folder service
		FolderValidator: func(ctx context.Context, folderUID string) (bool, error) {
			if folderUID == "" {
				return false, nil
			}
			orgID, err := reqns.OrgIDForList(ctx)
			user, _ := identity.GetRequester(ctx)
			if (err != nil || orgID < 1) && user != nil {
				orgID = user.GetOrgID()
			}
			if user == nil || orgID < 1 {
				// If we can't resolve identity/org in this context, don't block creation based on existence
				return true, nil
			}
			// Use the RuleStore to check namespace (folder) visibility
			_, err = ng.Api.RuleStore.GetNamespaceByUID(ctx, folderUID, orgID, user)
			if err != nil {
				return false, nil
			}
			return true, nil
		},
		BaseEvaluationInterval: ng.Cfg.UnifiedAlerting.BaseInterval,
		ReservedLabelKeys:      ngmodels.LabelsUserCannotSpecify,

		// TODO: ResolveRuleRef currently uses the legacy RuleStore (GetAlertRuleByUID).
		// In the legacy model, both alert rules and recording rules live in the same
		// alert_rule table, so this query covers both rule types referenced by a RuleChain.
		// When alert/recording rules move to k8s-native storage, this callback will need
		// to switch to a k8s client lookup (or be replaced by an informer-based resolver).
		ResolveRuleRef: func(ctx context.Context, uid string) (rulesAppConfig.RuleRef, bool, error) {
			orgID, err := reqns.OrgIDForList(ctx)
			if err != nil || orgID < 1 {
				if user, _ := identity.GetRequester(ctx); user != nil {
					orgID = user.GetOrgID()
				}
			}
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
		},
		ResolveRuleChainMemberships: resolveRuleChainMemberships,
		// Validate that the configured notification receiver exists in the Alertmanager config
		NotificationSettingsValidator: func(ctx context.Context, notificationSettings alertingv0alpha1.AlertRuleNotificationSettings) error {
			if notificationSettings.SimplifiedRouting != nil {
				if notificationSettings.SimplifiedRouting.Receiver == "" {
					return errors.New("receiver is empty")
				}
			}

			if notificationSettings.NamedRoutingTree != nil {
				if notificationSettings.NamedRoutingTree.RoutingTree == "" {
					return errors.New("routing tree is empty")
				}
			}

			if notificationSettings.NamedRoutingTree == nil && notificationSettings.SimplifiedRouting == nil {
				return errors.New("empty notification settings")
			}

			orgID, err := reqns.OrgIDForList(ctx)
			if err != nil || orgID < 1 {
				if user, _ := identity.GetRequester(ctx); user != nil {
					orgID = user.GetOrgID()
				}
			}
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

			settingsModel, err := alertrule.ConvertNotificationSettings(&notificationSettings)
			if err != nil {
				return err
			}

			if err := vd.Validate(settingsModel); err != nil {
				return err
			}

			return nil
		},
	}

	provider := simple.NewAppProvider(apis.LocalManifest(), appSpecificConfig, rulesApp.New)

	appConfig := app.Config{
		KubeConfig:     restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData:   *apis.LocalManifest().ManifestData,
		SpecificConfig: appSpecificConfig,
	}

	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &apis.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

func (a *AppInstaller) GetAuthorizer() authorizer.Authorizer {
	authz := a.ng.Api.AccessControl
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			switch a.GetResource() {
			case recordingrule.ResourceInfo.GroupResource().Resource:
				return recordingrule.Authorize(ctx, authz, a)
			case alertrule.ResourceInfo.GroupResource().Resource:
				return alertrule.Authorize(ctx, authz, a)
			case rulechain.ResourceInfo.GroupResource().Resource:
				return rulechain.Authorize(ctx, authz, a)
			}
			return authorizer.DecisionNoOpinion, "", nil
		},
	)
}

func (a *AppInstaller) GetStorageOptions(gr schema.GroupResource) *apistore.StorageOptions {
	if gr == rulechain.ResourceInfo.GroupResource() {
		return &apistore.StorageOptions{
			EnableFolderSupport: true,
		}
	}
	return nil
}

func (a *AppInstaller) GetLegacyStorage(gvr schema.GroupVersionResource) grafanarest.Storage {
	namespacer := reqns.GetNamespaceMapper(a.cfg)
	switch gvr {
	case recordingrule.ResourceInfo.GroupVersionResource():
		return recordingrule.NewStorage(*a.ng.Api.AlertRules, namespacer)
	case alertrule.ResourceInfo.GroupVersionResource():
		return alertrule.NewStorage(*a.ng.Api.AlertRules, namespacer)
	case rulechain.ResourceInfo.GroupVersionResource():
		return nil
	default:
		panic("unknown legacy storage requested: " + gvr.String())
	}
}
