package provisioning

import (
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func canUpdateWithProvenance(storedProvenance, provenance models.Provenance, errFun func() error) error {
	isFileProvenance := storedProvenance == models.ProvenanceFile
	isAPItoFileProvenance := storedProvenance == models.ProvenanceAPI && provenance == models.ProvenanceFile
	if storedProvenance != provenance && (isFileProvenance || isAPItoFileProvenance) {
		return errFun()
	}
	return nil
}
