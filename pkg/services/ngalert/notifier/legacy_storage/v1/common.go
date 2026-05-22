package v1

import "github.com/grafana/grafana/pkg/services/ngalert/models"

type ResourceUID string

type ResourceMetadata struct {
	UID        ResourceUID
	Version    string
	Provenance models.Provenance
}
