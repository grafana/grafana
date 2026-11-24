package legacy

import (
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// setUpdatePreconditions copies the object's resourceVersion and UID onto the rule, so that the rule service rejects
// an update made against a stale or replaced rule.
func setUpdatePreconditions(meta metav1.Object, rule *models.AlertRule) error {
	if version := meta.GetResourceVersion(); version != "" {
		parsed, err := strconv.ParseInt(version, 10, 64)
		if err != nil || parsed <= 0 {
			return apierrors.NewBadRequest("metadata.resourceVersion must be a positive integer")
		}
		rule.Version = parsed
	}
	rule.GUID = string(meta.GetUID())
	return nil
}
