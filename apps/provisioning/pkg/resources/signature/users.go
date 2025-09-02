package signature

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/resources"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const maxUsers = 10000

type loadUsersOnceSigner struct {
	signatures map[string]repository.CommitSignature
	client     dynamic.ResourceInterface
	once       sync.Once
	onceErr    error
}

// NewLoadUsersOnceSigner returns a Signer that loads the signatures from users
// it will only load the signatures once and cache them
// if the user is not found, it will use the grafana user as the author
func NewLoadUsersOnceSigner(client dynamic.ResourceInterface) Signer {
	return &loadUsersOnceSigner{
		client:     client,
		once:       sync.Once{},
		signatures: map[string]repository.CommitSignature{},
	}
}

func (s *loadUsersOnceSigner) Sign(ctx context.Context, item utils.GrafanaMetaAccessor) (context.Context, error) {
	if s.onceErr != nil {
		return ctx, fmt.Errorf("load signatures: %w", s.onceErr)
	}

	var err error
	s.once.Do(func() {
		s.signatures, err = s.load(ctx, s.client)
		s.onceErr = err
	})
	if err != nil {
		return ctx, fmt.Errorf("load signatures: %w", err)
	}

	id := item.GetUpdatedBy()
	if id == "" {
		id = item.GetCreatedBy()
	}
	if id == "" {
		id = "grafana"
	}

	sig := s.signatures[id] // lookup
	if sig.Name == "" && sig.Email == "" {
		sig.Name = id
	}
	t, err := item.GetUpdatedTimestamp()
	if err == nil && t != nil {
		sig.When = *t
	} else {
		sig.When = item.GetCreationTimestamp().Time
	}

	return repository.WithAuthorSignature(ctx, sig), nil
}

func (s *loadUsersOnceSigner) load(ctx context.Context, client dynamic.ResourceInterface) (map[string]repository.CommitSignature, error) {
	userInfo := make(map[string]repository.CommitSignature)
	var count int
	err := resources.ForEach(ctx, client, func(item *unstructured.Unstructured) error {
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
