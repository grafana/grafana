// Package managed helps apps that write validation policies keep them in line with the app's own
// resources, typically from a reconciler.
package managed

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/rest"

	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"
)

// Pair is a validation policy and the binding that enforces it. Both share Name.
type Pair struct {
	Namespace string
	Name      string
	// Labels identify the pair, for example the app and resource it was written for.
	Labels  map[string]string
	Policy  policyv0alpha1.ValidationPolicySpec
	Binding policyv0alpha1.ValidationPolicyBindingSpec
}

// Clients write policies and bindings.
type Clients struct {
	Policies *policyv0alpha1.ValidationPolicyClient
	Bindings *policyv0alpha1.ValidationPolicyBindingClient
}

// NewClients creates clients from an app's kube config.
func NewClients(cfg rest.Config) (Clients, error) {
	registry := k8s.NewClientRegistry(cfg, k8s.DefaultClientConfig())
	policies, err := registry.ClientFor(policyv0alpha1.ValidationPolicyKind())
	if err != nil {
		return Clients{}, fmt.Errorf("creating validation policy client: %w", err)
	}
	bindings, err := registry.ClientFor(policyv0alpha1.ValidationPolicyBindingKind())
	if err != nil {
		return Clients{}, fmt.Errorf("creating validation policy binding client: %w", err)
	}
	return Clients{
		Policies: policyv0alpha1.NewValidationPolicyClient(policies),
		Bindings: policyv0alpha1.NewValidationPolicyBindingClient(bindings),
	}, nil
}

// Ensure creates or updates the policy, then the binding, so a binding never refers to a policy
// that does not exist yet.
func (c Clients) Ensure(ctx context.Context, p Pair) error {
	id := resource.Identifier{Namespace: p.Namespace, Name: p.Name}
	meta := metav1.ObjectMeta{Namespace: p.Namespace, Name: p.Name, Labels: p.Labels}
	if err := ensure(ctx, id, c.Policies.Get, func(ctx context.Context) error {
		_, err := c.Policies.Create(ctx, &policyv0alpha1.ValidationPolicy{ObjectMeta: meta, Spec: p.Policy}, resource.CreateOptions{})
		return err
	}, func(ctx context.Context, existing *policyv0alpha1.ValidationPolicy) error {
		if equal(existing.Spec, p.Policy) {
			return nil
		}
		existing.Spec = p.Policy
		_, err := c.Policies.Update(ctx, existing, resource.UpdateOptions{ResourceVersion: existing.ResourceVersion})
		return err
	}); err != nil {
		return fmt.Errorf("policy %s: %w", p.Name, err)
	}
	if err := ensure(ctx, id, c.Bindings.Get, func(ctx context.Context) error {
		_, err := c.Bindings.Create(ctx, &policyv0alpha1.ValidationPolicyBinding{ObjectMeta: meta, Spec: p.Binding}, resource.CreateOptions{})
		return err
	}, func(ctx context.Context, existing *policyv0alpha1.ValidationPolicyBinding) error {
		if equal(existing.Spec, p.Binding) {
			return nil
		}
		existing.Spec = p.Binding
		_, err := c.Bindings.Update(ctx, existing, resource.UpdateOptions{ResourceVersion: existing.ResourceVersion})
		return err
	}); err != nil {
		return fmt.Errorf("binding %s: %w", p.Name, err)
	}
	return nil
}

// Remove deletes the binding, then the policy, so no binding outlives its policy.
func (c Clients) Remove(ctx context.Context, namespace, name string) error {
	id := resource.Identifier{Namespace: namespace, Name: name}
	var errs []error
	if err := c.Bindings.Delete(ctx, id, resource.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("binding %s: %w", name, err))
	}
	if err := c.Policies.Delete(ctx, id, resource.DeleteOptions{}); err != nil && !apierrors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("policy %s: %w", name, err))
	}
	return errors.Join(errs...)
}

func ensure[T any](
	ctx context.Context,
	id resource.Identifier,
	get func(context.Context, resource.Identifier) (T, error),
	create func(context.Context) error,
	update func(context.Context, T) error,
) error {
	existing, err := get(ctx, id)
	if apierrors.IsNotFound(err) {
		return create(ctx)
	}
	if err != nil {
		return err
	}
	return update(ctx, existing)
}

// equal compares specs by their serialized form, which is what the API stores.
func equal(a, b any) bool {
	ra, errA := json.Marshal(a)
	rb, errB := json.Marshal(b)
	return errA == nil && errB == nil && string(ra) == string(rb)
}
