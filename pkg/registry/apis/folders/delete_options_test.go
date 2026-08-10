package folders

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestForceDeleteFromDeleteOptions(t *testing.T) {
	zero := int64(0)
	one := int64(1)

	tests := []struct {
		name    string
		options *metav1.DeleteOptions
		want    bool
	}{
		{name: "nil options", options: nil, want: false},
		{name: "nil grace period", options: &metav1.DeleteOptions{}, want: false},
		{name: "grace period zero", options: &metav1.DeleteOptions{GracePeriodSeconds: &zero}, want: true},
		{name: "grace period non-zero", options: &metav1.DeleteOptions{GracePeriodSeconds: &one}, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, forceDeleteFromDeleteOptions(tt.options))
		})
	}
}
