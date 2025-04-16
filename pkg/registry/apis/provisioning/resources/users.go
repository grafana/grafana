package resources

import (
	"context"
	"errors"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
)

const maxUsers = 10000

func loadUsers(ctx context.Context, client dynamic.ResourceInterface) (map[string]repository.CommitSignature, error) {
	userInfo := make(map[string]repository.CommitSignature)
	var count int
	err := ForEach(ctx, client, func(item *unstructured.Unstructured) error {
		count++
		if count > maxUsers {
			return errors.New("too many users")
		}

		sig := repository.CommitSignature{}
		// FIXME: should we improve logging here?
		var (
			ok  bool
			err error
		)

		sig.Name, ok, err = unstructured.NestedString(item.Object, "spec", "login")
		if !ok || err != nil {
			return nil
		}
		sig.Email, ok, err = unstructured.NestedString(item.Object, "spec", "email")
		if !ok || err != nil {
			return nil
		}

		if sig.Name == sig.Email {
			if sig.Name == "" {
				sig.Name = item.GetName()
			} else if strings.Contains(sig.Email, "@") {
				sig.Email = "" // don't use the same value for name+email
			}
		}

		userInfo["user:"+item.GetName()] = sig
		return nil
	})
	if err != nil {
		return nil, err
	}

	return userInfo, nil
}
