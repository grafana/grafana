package historian

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	prometheus "github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	history_model "github.com/grafana/grafana/pkg/services/ngalert/state/historian/model"
)

const StateHistoryWriteTimeout = time.Minute

func shouldRecord(transition state.StateTransition) bool {
	if !transition.Changed() {
		return false
	}

	// Do not log not transitioned states normal states if it was marked as stale
	if transition.StateReason == models.StateReasonMissingSeries && transition.PreviousState == eval.Normal && transition.State.State == eval.Normal {
		return false
	}
	// Do not log transition from Normal (Paused|Updated) to Normal
	if transition.State.State == eval.Normal && transition.StateReason == "" &&
		transition.PreviousState == eval.Normal && (transition.PreviousStateReason == models.StateReasonPaused || transition.PreviousStateReason == models.StateReasonUpdated) {
		return false
	}
	return true
}

// ShouldRecordAnnotation returns true if an annotation should be created for a given state transition.
// This is stricter than shouldRecord to avoid cluttering panels with state transitions.
func ShouldRecordAnnotation(t state.StateTransition) bool {
	if !shouldRecord(t) {
		return false
	}

	// Do not log transitions when keeping last state
	toKeepLast := strings.Contains(t.StateReason, models.StateReasonKeepLast) && !strings.Contains(t.PreviousStateReason, models.StateReasonKeepLast)
	if toKeepLast {
		return false
	}

	// Do not record transitions between Normal and Normal (NoData)
	if t.State.State == eval.Normal && t.PreviousState == eval.Normal {
		if (t.StateReason == "" && t.PreviousStateReason == models.StateReasonNoData) ||
			(t.StateReason == models.StateReasonNoData && t.PreviousStateReason == "") {
			return false
		}
	}

	return true
}

func removePrivateLabels(labels data.Labels) data.Labels {
	result := make(data.Labels)
	for k, v := range labels {
		if !strings.HasPrefix(k, "__") && !strings.HasSuffix(k, "__") {
			result[k] = v
		}
	}
	return result
}

// labelFingerprint calculates a stable Prometheus-style signature for a label set.
func labelFingerprint(labels data.Labels) string {
	sig := prometheus.LabelsToSignature(labels)
	return fmt.Sprintf("%016x", sig)
}

func mergeLabels(base, into data.Labels) data.Labels {
	for k, v := range into {
		base[k] = v
	}
	return base
}
