package featureflags

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/featureflags/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ rest.Storage              = (*flagsStorage)(nil)
	_ rest.Scoper               = (*flagsStorage)(nil)
	_ rest.SingularNameProvider = (*flagsStorage)(nil)
	_ rest.Lister               = (*flagsStorage)(nil)
	_ rest.Getter               = (*flagsStorage)(nil)
)

type flagsStorage struct {
	store    *genericregistry.Store
	features *featuremgmt.FeatureManager
	cfg      *setting.Cfg
}

func (s *flagsStorage) New() runtime.Object {
	return resourceInfo.NewFunc()
}

func (s *flagsStorage) Destroy() {}

func (s *flagsStorage) NamespaceScoped() bool {
	return false
}

func (s *flagsStorage) GetSingularName() string {
	return resourceInfo.GetSingularName()
}

func (s *flagsStorage) NewList() runtime.Object {
	return resourceInfo.NewListFunc()
}

func (s *flagsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.store.TableConvertor.ConvertToTable(ctx, object, tableOptions)
}

func (s *flagsStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	flags := &v0alpha1.FeatureFlagList{}
	for _, flag := range s.features.GetFlags() {
		flags.Items = append(flags.Items, toK8sForm(ctx, flag, s.cfg, s.features))
	}
	return flags, nil
}

func (s *flagsStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	for _, flag := range s.features.GetFlags() {
		if name == flag.Name {
			obj := toK8sForm(ctx, flag, s.cfg, s.features)
			return &obj, nil
		}
	}
	return nil, fmt.Errorf("not found")
}

func toK8sForm(ctx context.Context, flag featuremgmt.FeatureFlag, cfg *setting.Cfg, features *featuremgmt.FeatureManager) v0alpha1.FeatureFlag {
	enabledFeatures := features.GetEnabled(ctx)
	return v0alpha1.FeatureFlag{
		TypeMeta: resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:              flag.Name,
			CreationTimestamp: metav1.NewTime(flag.Created),
		},
		Spec: v0alpha1.Spec{
			Description:       flag.Description,
			Enabled:           enabledFeatures[flag.Name],
			Stage:             flag.Stage.String(),
			Created:           flag.Created,
			Owner:             string(flag.Owner),
			AllowSelfServe:    flag.AllowSelfServe,
			HideFromAdminPage: flag.HideFromAdminPage,
			HideFromDocs:      flag.HideFromDocs,
			FrontendOnly:      flag.FrontendOnly,
			RequiresDevMode:   flag.RequiresDevMode,
			RequiresLicense:   flag.RequiresLicense,
			RequiresRestart:   flag.RequiresRestart,
			Hidden:            isFeatureHidden(flag, cfg.FeatureManagement.HiddenToggles),
			ReadOnly:          !isFeatureWriteable(flag, cfg.FeatureManagement.ReadOnlyToggles) || !isFeatureEditingAllowed(cfg),
		},
	}
}

// isFeatureHidden returns whether a toggle should be hidden from the admin page.
// filters out statuses Unknown, Experimental, and Private Preview
func isFeatureHidden(flag featuremgmt.FeatureFlag, hideCfg map[string]struct{}) bool {
	if _, ok := hideCfg[flag.Name]; ok {
		return true
	}
	return flag.Stage == featuremgmt.FeatureStageUnknown || flag.Stage == featuremgmt.FeatureStageExperimental || flag.Stage == featuremgmt.FeatureStagePrivatePreview || flag.HideFromAdminPage
}

// isFeatureWriteable returns whether a toggle on the admin page can be updated by the user.
// only allows writing of GA and Deprecated toggles, and excludes the feature toggle admin page toggle
func isFeatureWriteable(flag featuremgmt.FeatureFlag, readOnlyCfg map[string]struct{}) bool {
	if _, ok := readOnlyCfg[flag.Name]; ok {
		return false
	}
	if flag.Name == featuremgmt.FlagFeatureToggleAdminPage {
		return false
	}
	return (flag.Stage == featuremgmt.FeatureStageGeneralAvailability || flag.Stage == featuremgmt.FeatureStageDeprecated) && flag.AllowSelfServe
}

// isFeatureEditingAllowed checks if the backend is properly configured to allow feature toggle changes from the UI
func isFeatureEditingAllowed(cfg *setting.Cfg) bool {
	return cfg.FeatureManagement.AllowEditing && cfg.FeatureManagement.UpdateWebhook != ""
}
