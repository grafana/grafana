package migrate

import (
	"context"
	"errors"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

const maxUsers = 10000

func loadUsers(ctx context.Context, clients resources.ResourceClients) (map[string]repository.CommitSignature, error) {
	client, err := clients.User()
	if err != nil {
		return nil, err
	}

	userInfo := make(map[string]repository.CommitSignature)
	var count int
	err = resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
		count++
		if count > maxUsers {
			return errors.New("too many users")
		}

		sig := repository.CommitSignature{}
		// FIXME: should we improve logging here?
		var ok bool
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
