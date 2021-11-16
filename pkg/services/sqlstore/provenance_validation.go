package sqlstore

import (
	"github.com/grafana/grafana/pkg/models"
)

// WithProvenanceValidation given the object provenance decides whether the operation is allowed
func (ss *SQLStore) WithProvenanceValidation(cmd models.Provisionable, callback func() error) error {
	return withProvenanceValidation(cmd, callback)
}

func WithProvenanceValidation(cmd models.Provisionable, callback func() error) error {
	return withProvenanceValidation(cmd, callback)
}

func withProvenanceValidation(cmd models.Provisionable, callback func() error) error {
	if cmd.GetProvenance() != "" {
		return models.ErrModifyImmutableDashboard
	}
	return callback()
}
