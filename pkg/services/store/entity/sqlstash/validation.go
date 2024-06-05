package sqlstash

import "github.com/grafana/grafana/pkg/services/store/entity"

// validateEntity validates a fully loaded *entity.Entity model, and should be
// used before storing an entity to the database and before returning it to the
// user.
func validateEntity(*entity.Entity) error {
	return nil // TODO
}

// validateLabels validates the given map of label names to their values.
func validateLabels(map[string]string) error {
	// this should be called by validateEntity
	return nil // TODO
}

// validateFields validates the given map of fields names to their values.
func validateFields(map[string]string) error {
	// this should be called by validateEntity
	return nil // TODO
}
