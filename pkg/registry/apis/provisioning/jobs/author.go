package jobs

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

type AuthorResolver interface {
	ResolveAuthor(ctx context.Context, namespace, id string) (*repository.CommitSignature, error)
}

func NewUserAuthorResolver(clients resources.ClientFactory) AuthorResolver {
	return &userAuthorResolver{clients: clients}
}

type userAuthorResolver struct {
	clients resources.ClientFactory
}

func (r *userAuthorResolver) ResolveAuthor(ctx context.Context, namespace, id string) (*repository.CommitSignature, error) {
	t, uid, err := authlib.ParseTypeID(id)
	if err != nil {
		return nil, err
	}
	if t != authlib.TypeUser {
		return nil, nil
	}

	clients, err := r.clients.Clients(ctx, namespace)
	if err != nil {
		return nil, err
	}
	client, _, err := clients.ForResource(ctx, iamv0.UserResourceInfo.GroupVersionResource())
	if err != nil {
		return nil, err
	}
	obj, err := client.Get(ctx, uid, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	name, _, _ := unstructured.NestedString(obj.Object, "spec", "title")
	if name == "" {
		name, _, _ = unstructured.NestedString(obj.Object, "spec", "login")
	}
	email, _, _ := unstructured.NestedString(obj.Object, "spec", "email")
	if name == "" && email == "" {
		return nil, nil
	}

	return &repository.CommitSignature{Name: name, Email: email}, nil
}
