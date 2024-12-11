package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	provisioningInformer "github.com/grafana/grafana/pkg/generated/informers/externalversions/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/auth"
	"github.com/grafana/grafana/pkg/services/apiserver"
)

var (
	_ cache.ResourceEventHandler = (*repositoryInformer)(nil)
)

type repositoryInformer struct {
	configProvider apiserver.RestConfigProvider
	getter         RepoGetter
	identities     auth.BackgroundIdentityService
	logger         *slog.Logger
	// client to write???
}

func (r *repositoryInformer) init() error {
	// FIXME... hardcoded to default! (will fail in cloud)
	namespace := "default"
	id, err := r.identities.WorkerIdentity(context.Background(), namespace)
	if err != nil {
		return err
	}
	ctx := identity.WithRequester(context.Background(), id)
	fmt.Printf("Create a writing client with this ctx: %v", ctx)

	xxx := provisioningInformer.NewRepositoryInformer(nil, "default", time.Second*60, nil)

	_, err = xxx.AddEventHandler(r)

	// TODO! we also want a client that can write status

	return err
}

// OnAdd implements cache.ResourceEventHandler.
func (r *repositoryInformer) OnAdd(obj any, isInInitialList bool) {
	cfg, ok := obj.(*provisioning.Repository)
	if !ok {
		r.logger.Warn("expected repository")
		return
	}

	fmt.Printf("OnADD: %v / %v\n", isInInitialList, cfg)
}

// OnDelete implements cache.ResourceEventHandler.
func (r *repositoryInformer) OnDelete(obj any) {
	cfg, ok := obj.(*provisioning.Repository)
	if !ok {
		r.logger.Warn("expected repository")
		return
	}

	fmt.Printf("OnDelete: %v / %v\n", cfg)
}

// OnUpdate implements cache.ResourceEventHandler.
func (r *repositoryInformer) OnUpdate(oldObj any, newObj any) {
	cfg, ok := newObj.(*provisioning.Repository)
	if !ok {
		r.logger.Warn("expected repository")
		return
	}

	oldCfg, ok := oldObj.(*provisioning.Repository)
	if !ok {
		r.logger.Warn("expected repository")
		return
	}

	fmt.Printf("OnUpdate: %+v / %+v\n", cfg, oldCfg)
}
