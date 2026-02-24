package connection

import (
	"context"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
)

// SimpleConnectionTester validates the connection configuration and then tests the connection
type SimpleConnectionTester struct {
	factory Factory
}

func NewSimpleConnectionTester(factory Factory) *SimpleConnectionTester {
	return &SimpleConnectionTester{
		factory: factory,
	}
}

// TestConnection validates the connection and then runs a health check
func (t *SimpleConnectionTester) TestConnection(ctx context.Context, conn *provisioning.Connection) (*provisioning.TestResults, error) {
	// Structural validation without decryption
	errors := t.factory.Validate(ctx, conn)
	if len(errors) > 0 {
		rsp := &provisioning.TestResults{
			Code:    http.StatusUnprocessableEntity, // Invalid
			Success: false,
			Errors:  make([]provisioning.ErrorDetails, len(errors)),
		}
		for i, err := range errors {
			details := provisioning.ErrorDetails{
				Type:     metav1.CauseType(err.Type),
				Field:    err.Field,
				Detail:   err.Detail,
				BadValue: "",
			}
			if err.BadValue != nil {
				details.BadValue = err.BadValue
			}

			rsp.Errors[i] = details
		}
		return rsp, nil
	}

	// Build the connection to get a Connection interface
	connection, err := t.factory.Build(ctx, conn)
	if err != nil {
		// If build fails, return an error (this might happen if secrets are invalid)
		return &provisioning.TestResults{
			Code:    http.StatusInternalServerError,
			Success: false,
			Errors: []provisioning.ErrorDetails{{
				Type:   metav1.CauseTypeFieldValueInvalid,
				Field:  "",
				Detail: err.Error(),
			}},
		}, nil
	}

	// Run runtime validation via Test() method
	return connection.Test(ctx)
}
