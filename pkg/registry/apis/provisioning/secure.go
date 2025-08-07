package provisioning

import (
	"context"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret"
)

type decryptedValues struct {
	token         *secretv1beta1.ExposedSecureValue
	webhookSecret *secretv1beta1.ExposedSecureValue
}

func decrypt(ctx context.Context, r *provisioning.Repository, decryptSvc secret.DecryptService) (*decryptedValues, error) {
	results, err := decryptSvc.Decrypt(ctx, provisioning.GROUP, r.Namespace,
		r.Secure.Token.Name,
		r.Secure.WebhookSecret.Name,
	)
	if err != nil {
		return nil, err
	}

	// Get the
	getValue := func(path, name string) (*secretv1beta1.ExposedSecureValue, error) {
		if name == "" {
			return nil, nil
		}
		result := results[name]
		if result.Value() != nil {
			return result.Value(), nil
		}

		cause := metav1.StatusCause{
			Field:   path,
			Type:    metav1.CauseTypeFieldValueRequired,
			Message: "Not found",
		}
		if result.Error() != nil {
			cause.Type = metav1.CauseTypeFieldValueInvalid
			cause.Message = result.Error().Error()
		}
		return nil, &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    http.StatusPreconditionFailed,
			Reason:  metav1.StatusReasonStoreReadError,
			Message: "Error reading secret",
			Details: &metav1.StatusDetails{
				Causes: []metav1.StatusCause{cause},
			},
		}}
	}

	vals := &decryptedValues{}
	if vals.token, err = getValue("secure.token", r.Secure.Token.Name); err != nil {
		return nil, err
	}
	if vals.webhookSecret, err = getValue("secure.webhookSecret", r.Secure.WebhookSecret.Name); err != nil {
		return nil, err
	}
	return vals, nil
}
