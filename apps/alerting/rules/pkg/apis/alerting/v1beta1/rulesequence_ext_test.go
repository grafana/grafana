package v1beta1

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestRuleSequenceMemberError(t *testing.T) {
	err := NewRuleSequenceMemberError("rule-1", "seq-1")
	require.True(t, apierrors.IsForbidden(err))
	require.True(t, IsRuleSequenceMemberError(fmt.Errorf("wrapped: %w", err)))
	require.False(t, IsRuleSequenceMemberError(apierrors.NewForbidden(GroupVersion.WithResource("alertrules").GroupResource(), "rule-1", errors.New("other"))))

	// A client gets the error back as the status body of the response, which the apiserver stamps with its kind.
	var statusErr *apierrors.StatusError
	require.ErrorAs(t, err, &statusErr)
	status := statusErr.ErrStatus
	status.APIVersion, status.Kind = k8s.StatusAPIVersion, k8s.StatusKind
	body, jsonErr := json.Marshal(status)
	require.NoError(t, jsonErr)
	require.True(t, IsRuleSequenceMemberError(k8s.ParseKubernetesError(body, 403, nil)))
}
