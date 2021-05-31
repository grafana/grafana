package ualert

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"os"
	"path/filepath"
	"time"

	"github.com/gofrs/uuid"
	"github.com/matttproud/golang_protobuf_extensions/pbutil"
	pb "github.com/prometheus/alertmanager/silence/silencepb"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func (m *migration) addSilence(da dashAlert, rule *alertRule) error {
	if da.State != "paused" {
		return nil
	}

	uid, err := uuid.NewV4()
	if err != nil {
		return errors.New("failed to create uuid for silence")
	}

	n, v := getLabelForRouteMatching(rule.Uid)
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
			Comment:   "Created during auto migration to unified alerting",
		},
		ExpiresAt: time.Now().Add(365 * 20 * time.Hour), // 1 year.
	}

	m.silences = append(m.silences, s)
	return nil
}

func (m *migration) writeSilencesFile() error {
	var buf bytes.Buffer
	for _, e := range m.silences {
		if _, err := pbutil.WriteDelimited(&buf, e); err != nil {
			return err
		}
	}

	f, err := openReplace(silencesFileName(m.mg))
	if err != nil {
		return err
	}

	if _, err := io.Copy(f, bytes.NewReader(buf.Bytes())); err != nil {
		return err
	}

	return f.Close()
}

func silencesFileName(mg *migrator.Migrator) string {
	return filepath.Join(mg.Cfg.DataPath, "alerting", "silences")
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
