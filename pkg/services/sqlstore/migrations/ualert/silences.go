package ualert

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/matttproud/golang_protobuf_extensions/pbutil"
	pb "github.com/prometheus/alertmanager/silence/silencepb"
	"github.com/prometheus/common/model"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

const (
	// Should be the same as 'NoDataAlertName' in pkg/services/schedule/compat.go.
	NoDataAlertName = "DatasourceNoData"

	ErrorAlertName = "DatasourceError"
)

func (m *migration) addPauseSilence(orgId int64) error {
	uid, err := uuid.NewRandom()
	if err != nil {
		return errors.New("failed to create uuid for silence")
	}

	n, v := getLabelForPauseSilenceMatching()
	s := &pb.MeshSilence{
		Silence: &pb.Silence{
			Id: uid.String(),
			Matchers: []*pb.Matcher{
				{
					Type:    pb.Matcher_EQUAL,
					Name:    n,
					Pattern: v,
				},
			},
			StartsAt:  time.Now(),
			EndsAt:    time.Now().Add(365 * 20 * time.Hour), // 1 year.
			CreatedBy: "Grafana Migration",
			Comment:   "Created during migration to unified alerting to silence paused alerts",
		},
		ExpiresAt: time.Now().Add(365 * 20 * time.Hour), // 1 year.
	}

	_, ok := m.silences[orgId]
	if !ok {
		m.silences[orgId] = make([]*pb.MeshSilence, 0)
	}
	m.silences[orgId] = append(m.silences[orgId], s)
	return nil
}

func (m *migration) addErrorSilence(orgId int64) error {
	uid, err := uuid.NewRandom()
	if err != nil {
		return errors.New("failed to create uuid for silence")
	}

	n, v := getLabelForErrorSilenceMatching()
	s := &pb.MeshSilence{
		Silence: &pb.Silence{
			Id: uid.String(),
			Matchers: []*pb.Matcher{
				{
					Type:    pb.Matcher_EQUAL,
					Name:    model.AlertNameLabel,
					Pattern: ErrorAlertName,
				},
				{
					Type:    pb.Matcher_EQUAL,
					Name:    n,
					Pattern: v,
				},
			},
			StartsAt:  time.Now(),
			EndsAt:    time.Now().AddDate(1, 0, 0), // 1 year
			CreatedBy: "Grafana Migration",
			Comment:   "Created during migration to unified alerting to silence Error state when the option 'Keep Last State' was selected for Error state",
		},
		ExpiresAt: time.Now().AddDate(1, 0, 0), // 1 year
	}
	if _, ok := m.silences[orgId]; !ok {
		m.silences[orgId] = make([]*pb.MeshSilence, 0)
	}
	m.silences[orgId] = append(m.silences[orgId], s)
	return nil
}

func (m *migration) addNoDataSilence(orgId int64) error {
	uid, err := uuid.NewRandom()
	if err != nil {
		return errors.New("failed to create uuid for silence")
	}

	n, v := getLabelForNoDataSilenceMatching()
	s := &pb.MeshSilence{
		Silence: &pb.Silence{
			Id: uid.String(),
			Matchers: []*pb.Matcher{
				{
					Type:    pb.Matcher_EQUAL,
					Name:    model.AlertNameLabel,
					Pattern: NoDataAlertName,
				},
				{
					Type:    pb.Matcher_EQUAL,
					Name:    n,
					Pattern: v,
				},
			},
			StartsAt:  time.Now(),
			EndsAt:    time.Now().AddDate(1, 0, 0), // 1 year.
			CreatedBy: "Grafana Migration",
			Comment:   "Created during migration to unified alerting to silence NoData state when the option 'Keep Last State' was selected for NoData state",
		},
		ExpiresAt: time.Now().AddDate(1, 0, 0), // 1 year.
	}
	_, ok := m.silences[orgId]
	if !ok {
		m.silences[orgId] = make([]*pb.MeshSilence, 0)
	}
	m.silences[orgId] = append(m.silences[orgId], s)
	return nil
}

func (m *migration) writeSilencesFile(orgID int64) error {
	var buf bytes.Buffer
	orgSilences, ok := m.silences[orgID]
	if !ok {
		return nil
	}

	for _, e := range orgSilences {
		if _, err := pbutil.WriteDelimited(&buf, e); err != nil {
			return err
		}
	}

	f, err := openReplace(silencesFileNameForOrg(m.mg, orgID))
	if err != nil {
		return err
	}

	if _, err := io.Copy(f, bytes.NewReader(buf.Bytes())); err != nil {
		return err
	}

	return f.Close()
}

func getSilenceFileNamesForAllOrgs(mg *migrator.Migrator) ([]string, error) {
	return filepath.Glob(filepath.Join(mg.Cfg.DataPath, "alerting", "*", "silences"))
}

func silencesFileNameForOrg(mg *migrator.Migrator, orgID int64) string {
	return filepath.Join(mg.Cfg.DataPath, "alerting", strconv.Itoa(int(orgID)), "silences")
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
func openReplace(filename string) (*replaceFile, error) {
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

func getLabelForPauseSilenceMatching() (string, string) {
	return "migration_paused", "true"
}

func getLabelForErrorSilenceMatching() (string, string) {
	return "migration_keep_last_state_error", "true"
}

func getLabelForNoDataSilenceMatching() (string, string) {
	return "migration_keep_last_state_nodata", "true"
}
