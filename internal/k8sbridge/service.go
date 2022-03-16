// Package k8sbridge provides interfaces
// for communicating with an underlying kube-apiserver.
package k8sbridge

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"k8s.io/apimachinery/pkg/runtime"
	k8schema "k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/scheme"

	"github.com/grafana/grafana/internal/components"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// CoremodelLister provides a list of coremodels to be registered to Service.
type CoremodelLister interface {
	List() []components.Coremodel
}

// Service is the service that registers all schemas, CRDs and clients to Kubernetes.
// It is also responsible for registering and managing Kubernetes controllers and providing client Config.
type Service struct {
	enabled   bool
	config    *rest.Config
	clientset *Clientset
	manager   ctrl.Manager
	logger    log.Logger
}

// ProvideService returns a new Service which registers models from list.
// It is disabled if the intentapi flag is disabled in the feature toggles.
func ProvideService(cfg *setting.Cfg, feat featuremgmt.FeatureToggles, list CoremodelLister) (*Service, error) {
	enabled := feat.IsEnabled(featuremgmt.FlagIntentapi)
	if !enabled {
		return &Service{
			enabled: false,
		}, nil
	}

	config, err := LoadRestConfig(cfg)
	if err != nil {
		return nil, err
	}

	clientset, err := NewClientset(config)
	if err != nil {
		return nil, err
	}

	models := list.List()

	scheme, err := GenerateScheme(models)
	if err != nil {
		return nil, err
	}

	mgr, err := ctrl.NewManager(config, ctrl.Options{
		Scheme: scheme,
	})
	if err != nil {
		return nil, err
	}

	s := &Service{
		config:    config,
		clientset: clientset,
		manager:   mgr,
		enabled:   enabled,
		logger:    log.New("k8sbridge.service"),
	}

	if err := s.RegisterModels(context.TODO(), models...); err != nil {
		return nil, err
	}

	return s, nil
}

// IsDisabled
func (s *Service) IsDisabled() bool {
	return !s.enabled
}

// Run
func (s *Service) Run(ctx context.Context) error {
	if err := s.manager.Start(ctx); err != nil {
		return err
	}

	return nil
}

// RegisterModels registers models to clientset and controller manager.
func (s *Service) RegisterModels(ctx context.Context, models ...components.Coremodel) error {
	for _, m := range models {
		if err := s.clientset.RegisterSchema(ctx, m.Schema()); err != nil {
			return err
		}

		if err := m.RegisterController(s.manager); err != nil {
			return err
		}
	}

	return nil
}

// RestConfig returns rest Config for talking to kube-apiserver.
func (s *Service) RestConfig() *rest.Config {
	return s.config
}

// LoadRestConfig loads rest.Config based on settings in cfg.
func LoadRestConfig(cfg *setting.Cfg) (*rest.Config, error) {
	sec := cfg.Raw.Section("intentapi.kubebridge")
	configPath := sec.Key("kubeconfig_path").MustString("")

	if configPath == "" {
		return nil, errors.New("kubeconfig path cannot be empty when using Intent API")
	}

	configPath = filepath.Clean(configPath)

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("cannot find kubeconfig file at '%s'", configPath)
	}

	return clientcmd.BuildConfigFromFlags("", configPath)
}

// GenerateScheme generates a kubernetes runtime Scheme from a list of models.
func GenerateScheme(models []components.Coremodel) (*runtime.Scheme, error) {
	res := runtime.NewScheme()

	for _, m := range models {
		s := m.Schema()

		schemaBuilder := &scheme.Builder{
			GroupVersion: k8schema.GroupVersion{
				Group:   s.GroupName(),
				Version: s.GroupVersion(),
			},
		}
		schemaBuilder.Register(s.RuntimeObjects()...)

		if err := schemaBuilder.AddToScheme(res); err != nil {
			return nil, err
		}
	}

	return res, nil
}
