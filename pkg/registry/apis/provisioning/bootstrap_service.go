package provisioning

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/grafana-app-sdk/logging"
	clientrest "k8s.io/client-go/rest"

	clientset "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/bootstrap"
	"github.com/grafana/grafana/pkg/setting"
)

// BootstrapServiceName is the background-service module name of [BootstrapService].
const BootstrapServiceName = "provisioning-bootstrap"

var _ registry.CanBeDisabled = (*BootstrapService)(nil)

// BootstrapService registers, updates or removes the repository configured by
// [provisioning] bootstrap_path once the provisioning API is served, then
// closes [BootstrapService.Done].
type BootstrapService struct {
	*loopbackService

	config    bootstrap.Config
	done      chan struct{}
	closeDone func()

	repositories func(restConfig *clientrest.Config, namespace string) (bootstrap.Repositories, error)
}

// ProvideBootstrapService is called by Wire. Depending on the builder orders it
// after [RegisterAPIService], which registers the provisioning API group with
// the API server.
func ProvideBootstrapService(cfg *setting.Cfg, builder *APIBuilder) (*BootstrapService, error) {
	done := make(chan struct{})
	s := &BootstrapService{
		done:         done,
		closeDone:    sync.OnceFunc(func() { close(done) }),
		repositories: newBootstrapRepositories,
	}
	if builder != nil {
		config, err := bootstrapConfigFromSettings(cfg)
		if err != nil {
			return nil, err
		}
		s.config = config
		builder.bootstrapDone = done
	}
	s.loopbackService = newLoopbackService(BootstrapServiceName, builder, false, s.runController)
	// Closed on every path, including shutdown before the API is served, so
	// nothing waits on Done forever.
	s.onStop = s.closeDone
	return s, nil
}

// IsDisabled implements registry.CanBeDisabled. disable_controllers does not
// disable it: the bootstrap repository is configuration, not a controller.
func (s *BootstrapService) IsDisabled() bool {
	return s.builder == nil
}

// Done is closed once the bootstrap repository has been reconciled, whether or
// not that succeeded, so a changed or cleared bootstrap_path is applied before
// the repository controller syncs the repository it replaces.
func (s *BootstrapService) Done() <-chan struct{} {
	return s.done
}

func (s *BootstrapService) runController(ctx context.Context, restConfig *clientrest.Config) error {
	s.reconcile(ctx, restConfig)
	s.closeDone()

	// Returning would leave this module Terminated, and dskit fails the
	// background-services module that depends on it if it is not Running when
	// that module starts.
	<-ctx.Done()
	return nil
}

func (s *BootstrapService) reconcile(ctx context.Context, restConfig *clientrest.Config) {
	// Runs with no path configured too, to remove a repository a previous run registered.
	if !s.config.Reconcilable() {
		return
	}

	logger := logging.FromContext(ctx).With("path", s.config.Path, "namespace", s.config.Namespace)
	repos, err := s.repositories(restConfig, s.config.Namespace)
	if err == nil {
		err = bootstrap.Reconcile(ctx, repos, s.config)
	}
	// Never fatal: a rejected bootstrap repository must not keep the instance down.
	if err != nil {
		logger.Error("failed to reconcile bootstrap repository", "error", err)
	}
}

func newBootstrapRepositories(restConfig *clientrest.Config, namespace string) (bootstrap.Repositories, error) {
	client, err := clientset.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("create provisioning clientset: %w", err)
	}
	return client.ProvisioningV0alpha1().Repositories(namespace), nil
}
