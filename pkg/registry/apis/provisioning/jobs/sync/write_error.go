package sync

import (
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
)

// createdNothing reports whether a failed create was rejected before anything was
// written, so a quota slot reserved for it can be handed back to the next file.
func createdNothing(err error) bool {
	return utils.IsForbiddenManagerKindChangeError(err) ||
		errors.Is(err, resources.ErrSecureValuesNotAllowed)
}
