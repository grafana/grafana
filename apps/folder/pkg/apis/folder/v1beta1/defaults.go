package v1beta1

import "k8s.io/apimachinery/pkg/runtime"

// RegisterDefaults is a no-op; kept for parity with generated API packages.
func RegisterDefaults(*runtime.Scheme) error {
	return nil
}
