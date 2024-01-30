package migration

import (
	"bytes"
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/matttproud/golang_protobuf_extensions/pbutil"
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
	createSilenceFile            func(filename string) (io.WriteCloser, error)

	dataPath string
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
func (sh *silenceHandler) createSilences(orgID int64, log log.Logger) error {
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
		log.Debug("Writing silences file", "silences", len(silences))
		if err := sh.writeSilencesFile(orgID, silences); err != nil {
			return fmt.Errorf("write silence file: %w", err)
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

func (sh *silenceHandler) writeSilencesFile(orgId int64, silences []*pb.MeshSilence) error {
	var buf bytes.Buffer
	for _, e := range silences {
		if _, err := pbutil.WriteDelimited(&buf, e); err != nil {
			return err
		}
	}

	f, err := sh.createSilenceFile(silencesFileNameForOrg(sh.dataPath, orgId))
	if err != nil {
		return err
	}

	if _, err := io.Copy(f, bytes.NewReader(buf.Bytes())); err != nil {
		return err
	}

	return f.Close()
}

func silencesFileNameForOrg(dataPath string, orgID int64) string {
	return filepath.Join(dataPath, "alerting", strconv.Itoa(int(orgID)), "silences")
}

// replaceFile wraps a file that is moved to another filename on closing.
type replaceFile struct {
	*os.File
	filename string
}

func (f *replaceFile) Close() error {
	if err := f.File.Sync(); err != nil {
		return err
	}
	if err := f.File.Close(); err != nil {
		return err
	}
	return os.Rename(f.File.Name(), f.filename)
}

// openReplace opens a new temporary file that is moved to filename on closing.
func openReplace(filename string) (io.WriteCloser, error) {
	tmpFilename := fmt.Sprintf("%s.%x", filename, uint64(rand.Int63()))

	if err := os.MkdirAll(filepath.Dir(tmpFilename), os.ModePerm); err != nil {
		return nil, err
	}

	//nolint:gosec
	f, err := os.Create(tmpFilename)
	if err != nil {
		return nil, err
	}

	rf := &replaceFile{
		File:     f,
		filename: filename,
	}
	return rf, nil
}
