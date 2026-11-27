package v1beta2

import "k8s.io/apimachinery/pkg/runtime"

// RegisterConversions registers every conversion between v0alpha1 and v1beta2: the kinds, their
// lists, and the subresource and route types.
func RegisterConversions(s *runtime.Scheme) error {
	for _, register := range []func(*runtime.Scheme) error{
		RegisterRepositoryConversions,
		RegisterConnectionConversions,
		RegisterJobConversions,
		RegisterSubresourceConversions,
	} {
		if err := register(s); err != nil {
			return err
		}
	}
	return nil
}
