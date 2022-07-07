package contactpoints

import (
	"context"

	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

type ContactPointProvisioner struct{
	
}

func Provision(ctx context.Context, path string, contactPointService *provisioning.ContactPointService) error {
	return nil
}
