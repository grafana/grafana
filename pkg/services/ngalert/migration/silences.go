package migration

import (
	"context"
	"fmt"
	"time"

	pb "github.com/prometheus/alertmanager/silence/silencepb"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	ngstate "github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/util"
)

// TimeNow makes it possible to test usage of time
var TimeNow = time.Now

// silenceHandler is a helper for managing and writing migration silences.
type silenceHandler struct {
	rulesWithErrorSilenceLabels  int
	rulesWithNoDataSilenceLabels int
	persistSilences              func(context.Context, int64, []*pb.MeshSilence) error
}

// handleSilenceLabels adds labels to the alert rule if the rule requires silence labels for error/nodata keep_state.
func (sh *silenceHandler) handleSilenceLabels(ar *models.AlertRule, parsedSettings dashAlertSettings) {
	if parsedSettings.ExecutionErrorState == "keep_state" {
		sh.rulesWithErrorSilenceLabels++
		ar.Labels[models.MigratedSilenceLabelErrorKeepState] = "true"
	}
	if parsedSettings.NoDataState == "keep_state" {
		sh.rulesWithNoDataSilenceLabels++
		ar.Labels[models.MigratedSilenceLabelNodataKeepState] = "true"
	}
}

// createSilences creates silences and writes them to a file.
func (sh *silenceHandler) createSilences(ctx context.Context, orgID int64, log log.Logger) error {
	var silences []*pb.MeshSilence
	if sh.rulesWithErrorSilenceLabels > 0 {
		log.Info("Creating silence for rules with ExecutionErrorState = keep_state", "rules", sh.rulesWithErrorSilenceLabels)
		silences = append(silences, errorSilence())
	}
	if sh.rulesWithNoDataSilenceLabels > 0 {
		log.Info("Creating silence for rules with NoDataState = keep_state", "rules", sh.rulesWithNoDataSilenceLabels)
		silences = append(silences, noDataSilence())
	}
	if len(silences) > 0 {
		log.Debug("Writing silences to kvstore", "silences", len(silences))
		if err := sh.persistSilences(ctx, orgID, silences); err != nil {
			return fmt.Errorf("write silences to kvstore: %w", err)
		}
	}
	return nil
}

// errorSilence creates a silence that matches DatasourceError alerts for rules which have a label attached when ExecutionErrorState was set to keep_state.
func errorSilence() *pb.MeshSilence {
	return &pb.MeshSilence{
		Silence: &pb.Silence{
			Id: util.GenerateShortUID(),
			Matchers: []*pb.Matcher{
				{
					Type:    pb.Matcher_EQUAL,
					Name:    model.AlertNameLabel,
					Pattern: ngstate.ErrorAlertName,
				},
				{
					Type:    pb.Matcher_EQUAL,
					Name:    models.MigratedSilenceLabelErrorKeepState,
					Pattern: "true",
				},
			},
			StartsAt:  TimeNow(),
			EndsAt:    TimeNow().AddDate(1, 0, 0), // 1 year
			CreatedBy: "Grafana Migration",
			Comment:   "Created during migration to unified alerting to silence Error state when the option 'Keep Last State' was selected for Error state",
		},
		ExpiresAt: TimeNow().AddDate(1, 0, 0), // 1 year
	}
}

// noDataSilence creates a silence that matches DatasourceNoData alerts for rules which have a label attached when NoDataState was set to keep_state.
func noDataSilence() *pb.MeshSilence {
	return &pb.MeshSilence{
		Silence: &pb.Silence{
			Id: util.GenerateShortUID(),
			Matchers: []*pb.Matcher{
				{
					Type:    pb.Matcher_EQUAL,
					Name:    model.AlertNameLabel,
					Pattern: ngstate.NoDataAlertName,
				},
				{
					Type:    pb.Matcher_EQUAL,
					Name:    models.MigratedSilenceLabelNodataKeepState,
					Pattern: "true",
				},
			},
			StartsAt:  TimeNow(),
			EndsAt:    TimeNow().AddDate(1, 0, 0), // 1 year.
			CreatedBy: "Grafana Migration",
			Comment:   "Created during migration to unified alerting to silence NoData state when the option 'Keep Last State' was selected for NoData state",
		},
		ExpiresAt: TimeNow().AddDate(1, 0, 0), // 1 year.
	}
}
