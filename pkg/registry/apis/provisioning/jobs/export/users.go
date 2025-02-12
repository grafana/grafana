package export

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

func (r *exportJob) loadUsers(ctx context.Context) error {
	status := r.jobStatus
	status.Message = "reading user info"
	r.maybeNotify(ctx)

	client := r.client.Resource(schema.GroupVersionResource{
		Group:    iam.GROUP,
		Version:  iam.VERSION,
		Resource: iam.UserResourceInfo.GroupResource().Resource,
	})

	rawList, err := client.List(ctx, metav1.ListOptions{Limit: 10000})
	if err != nil {
		return fmt.Errorf("failed to list users: %w", err)
	}
	if rawList.GetContinue() != "" {
		return fmt.Errorf("unable to list all users in one request: %s", rawList.GetContinue())
	}

	var ok bool
	r.userInfo = make(map[string]repository.CommitSignature)
	for _, item := range rawList.Items {
		sig := repository.CommitSignature{}
		sig.Name, ok, err = unstructured.NestedString(item.Object, "spec", "login")
		if !ok || err != nil {
			continue
		}
		sig.Email, ok, err = unstructured.NestedString(item.Object, "spec", "email")
		if !ok || err != nil {
			continue
		}
		r.userInfo["user:"+item.GetName()] = sig
	}

	return nil
}
