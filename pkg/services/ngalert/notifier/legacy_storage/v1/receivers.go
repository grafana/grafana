package v1

import "github.com/grafana/grafana/pkg/services/ngalert/models"

// ReceiverUID returns the deterministic UID for a receiver group with the given name.
func ReceiverUID(name string) ResourceUID {
	return ResourceUID(models.NameToUid(name))
}
