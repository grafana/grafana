package export

import (
	"context"
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

func (r *exportJob) loadUsers(ctx context.Context) error {
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
		// FIXME: should we improve logging here?
		sig.Name, ok, err = unstructured.NestedString(item.Object, "spec", "login")
		if !ok || err != nil {
			continue
		}
		sig.Email, ok, err = unstructured.NestedString(item.Object, "spec", "email")
		if !ok || err != nil {
			continue
		}

		if sig.Name == sig.Email {
			if sig.Name == "" {
				sig.Name = item.GetName()
			} else if strings.Contains(sig.Email, "@") {
				sig.Email = "" // don't use the same value for name+email
			}
		}

		r.userInfo["user:"+item.GetName()] = sig
	}

	return nil
}
