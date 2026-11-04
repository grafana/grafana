// Package rpclient lets API servers manage the IAM ResourcePermission of the resources they serve.
package rpclient

import (
	"context"
	"fmt"
	"sync"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	authlib "github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/restcfg"
)

// ClientProvider returns the IAM ResourcePermission client.
type ClientProvider func(ctx context.Context) (dynamic.NamespaceableResourceInterface, error)

// Static returns a provider for an already built client, such as one reaching a standalone IAM app.
func Static(client dynamic.NamespaceableResourceInterface) ClientProvider {
	return func(context.Context) (dynamic.NamespaceableResourceInterface, error) {
		return client, nil
	}
}

// FromRestConfig builds the client lazily: the loopback rest config is not ready while the services
// are provided. Failures are not cached.
func FromRestConfig(restConfigProvider restcfg.RestConfigProvider) ClientProvider {
	var (
		mu     sync.Mutex
		client dynamic.NamespaceableResourceInterface
	)
	return func(ctx context.Context) (dynamic.NamespaceableResourceInterface, error) {
		mu.Lock()
		defer mu.Unlock()
		if client != nil {
			return client, nil
		}
		cfg, err := restConfigProvider.GetRestConfig(ctx)
		if err != nil {
			return nil, fmt.Errorf("get rest config: %w", err)
		}
		dyn, err := dynamic.NewForConfig(cfg)
		if err != nil {
			return nil, fmt.Errorf("create dynamic client: %w", err)
		}
		client = dyn.Resource(iamv0.ResourcePermissionInfo.GroupVersionResource())
		return client, nil
	}
}

// Name returns the name of the ResourcePermission holding the permissions of a resource.
func Name(gr schema.GroupResource, name string) string {
	return fmt.Sprintf("%s-%s-%s", gr.Group, gr.Resource, name)
}

// Permissions manages the ResourcePermissions of one group resource.
type Permissions struct {
	client ClientProvider
	gr     schema.GroupResource
}

// New returns the Permissions of the resources of gr.
func New(client ClientProvider, gr schema.GroupResource) *Permissions {
	return &Permissions{client: client, gr: gr}
}

// DeletePermissions removes the permissions of a deleted resource. A missing permission counts as deleted.
func (p *Permissions) DeletePermissions(ctx context.Context, namespace, name string) error {
	rpName := Name(p.gr, name)
	if err := p.delete(ctx, namespace, rpName); err != nil {
		return fmt.Errorf("delete resource permission %s/%s: %w", namespace, rpName, err)
	}
	return nil
}

func (p *Permissions) delete(ctx context.Context, namespace, name string) error {
	ns, err := authlib.ParseNamespace(namespace)
	if err != nil {
		return fmt.Errorf("parse namespace: %w", err)
	}
	client, err := p.client(ctx)
	if err != nil {
		return fmt.Errorf("get IAM resource permission client: %w", err)
	}
	if client == nil {
		return fmt.Errorf("IAM resource permission client is not configured")
	}

	// The cleanup follows a deletion the caller was already allowed to make.
	ctx = identity.WithServiceIdentityContext(ctx, ns.OrgID)
	err = client.Namespace(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return err
	}
	return nil
}
