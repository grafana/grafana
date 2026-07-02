package github

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/endpoints/request"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type connectionWebhookValidator struct {
	connGetter repository.ConnectionSpecGetter
}

// NewConnectionWebhookValidator returns a Validator that rejects a GitHub repository
// which references a webhook-disabled connection but does not itself set spec.webhook.disabled: true.
func NewConnectionWebhookValidator(getter repository.ConnectionSpecGetter) repository.Validator {
	return &connectionWebhookValidator{connGetter: getter}
}

func (v *connectionWebhookValidator) Validate(ctx context.Context, cfg *provisioning.Repository) field.ErrorList {
	if cfg.Spec.Type != provisioning.GitHubRepositoryType {
		return nil
	}

	if cfg.Spec.Connection == nil || cfg.Spec.Connection.Name == "" {
		return nil
	}

	if cfg.Spec.Webhook != nil && cfg.Spec.Webhook.Disabled {
		return nil
	}

	var err error
	ctx, _, err = identity.WithProvisioningIdentity(ctx, cfg.Namespace)
	if err != nil {
		return field.ErrorList{field.InternalError(field.NewPath("spec", "connection", "name"), err)}
	}
	ctx = request.WithNamespace(ctx, cfg.Namespace)

	conn, err := v.connGetter.GetConnectionSpec(ctx, cfg.Spec.Connection.Name)
	if err != nil {
		if apierrors.IsNotFound(err) {
			return nil
		}
		return field.ErrorList{field.InternalError(field.NewPath("spec", "connection", "name"), err)}
	}

	if conn.Spec.Webhook != nil && conn.Spec.Webhook.Disabled {
		return field.ErrorList{field.Invalid(
			field.NewPath("spec", "webhook", "disabled"),
			false,
			"must be true because the referenced connection has webhook.disabled set to true",
		)}
	}

	return nil
}
