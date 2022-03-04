// Package k8sbridge provides interfaces for communicating with an underlying
// Kubernetes apiserver

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

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	groupName = "grafana.core.group"
	// TODO come up with rule governing when and why this is incremented
	groupVersion = "v1alpha1"
)

// Service
type Service struct {
	config  *rest.Config
	client  *Clientset
	schemas schema.CoreSchemaList
	manager ctrl.Manager
	enabled bool
	logger  log.Logger
}

// ProvideService
func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, list schema.CoreSchemaList) (*Service, error) {
	enabled := features.IsEnabled(featuremgmt.FlagIntentapi)
	if !enabled {
		return &Service{
			enabled: false,
		}, nil
	}

	sec := cfg.Raw.Section("intentapi.kubebridge")
	configPath := sec.Key("kubeconfig_path").MustString("")

	if configPath == "" {
		return nil, errors.New("kubeconfig path cannot be empty when using Intent API")
	}

	configPath = filepath.Clean(configPath)

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("cannot find kubeconfig file at '%s'", configPath)
	}

	config, err := clientcmd.BuildConfigFromFlags("", configPath)
	if err != nil {
		return nil, err
	}

	cset, err := NewClientset(config)
	if err != nil {
		return nil, err
	}

	schm := runtime.NewScheme()
	schemaGroupVersion := k8schema.GroupVersion{
		Group:   groupName,
		Version: groupVersion,
	}
	schemaBuilder := &scheme.Builder{
		GroupVersion: schemaGroupVersion,
	}

	if err := schemaBuilder.AddToScheme(schm); err != nil {
		return nil, err
	}

	for _, cr := range list {
		schemaBuilder.Register(cr.GetRuntimeObjects()...)
	}

	mgr, err := ctrl.NewManager(config, ctrl.Options{
		Scheme: schm,
	})
	if err != nil {
		return nil, err
	}

	return &Service{
		config:  config,
		client:  cset,
		schemas: list,
		manager: mgr,
		enabled: enabled,
		logger:  log.New("k8sbridge.service"),
	}, nil
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

// Schemas
func (s *Service) Schemas() schema.CoreSchemaList {
	return s.schemas
}

// RestConfig
func (s *Service) RestConfig() *rest.Config {
	return s.config
}

// Client
func (s *Service) Client() *Clientset {
	return s.client
}

// ControllerManager
func (s *Service) ControllerManager() ctrl.Manager {
	return s.manager
}
