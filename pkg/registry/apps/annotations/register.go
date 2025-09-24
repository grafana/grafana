package annotations

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	restclient "k8s.io/client-go/rest"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/annotations/pkg/apis"
	annotation "github.com/grafana/grafana/apps/annotations/pkg/apis/annotation/v0alpha1"
	annotationsapp "github.com/grafana/grafana/apps/annotations/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller       = (*AnnotationsAppInstaller)(nil)
	_ appinstaller.LegacyStorageProvider = (*AnnotationsAppInstaller)(nil)
)

type AnnotationsAppInstaller struct {
	appsdkapiserver.AppInstaller
	legacyService annotations.Repository
	namespacer    request.NamespaceMapper
}

func RegisterAppInstaller(cfg *setting.Cfg, features featuremgmt.FeatureToggles, legacyService annotations.Repository) (*AnnotationsAppInstaller, error) {
	installer := &AnnotationsAppInstaller{
		legacyService: legacyService,
		namespacer:    request.GetNamespaceMapper(cfg),
	}
	provider := simple.NewAppProvider(apis.LocalManifest(), nil, annotationsapp.New)
	appConfig := app.Config{
		KubeConfig:   restclient.Config{}, // this will be overridden by the installer's InitializeApp method
		ManifestData: *apis.LocalManifest().ManifestData,
	}
	i, err := appsdkapiserver.NewDefaultAppInstaller(provider, appConfig, &apis.GoTypeAssociator{})
	if err != nil {
		return nil, err
	}
	installer.AppInstaller = i
	return installer, nil
}

func (s *AnnotationsAppInstaller) GetLegacyStorage(requested schema.GroupVersionResource) grafanarest.Storage {
	gvr := schema.GroupVersionResource{
		Group:    annotation.AnnotationKind().Group(),
		Version:  annotation.AnnotationKind().Version(),
		Resource: annotation.AnnotationKind().Plural(),
	}
	if requested.String() != gvr.String() {
		return nil
	}
	legacyStore := annotationsapp.NewSimpleLegacyAnnotationStorage(s.legacyService)
	legacyStore.SetTableConverter(utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Dashboard", Type: "string", Format: "string", Description: "The dashboard UID"},
				{Name: "Text", Type: "string", Format: "string", Description: "The annotation text"},
				{Name: "Created", Type: "string", Format: "date"},
			},
			Reader: func(obj any) ([]interface{}, error) {
				m, ok := obj.(*annotation.Annotation)
				if !ok {
					return nil, fmt.Errorf("expected annotation")
				}
				return []interface{}{
					m.Name,
					m.Spec.DashboardUID,
					m.Spec.Text,
					m.ObjectMeta.CreationTimestamp.Format("2006-01-02T15:04:05Z"),
				}, nil
			},
		},
	))
	return legacyStore
}
