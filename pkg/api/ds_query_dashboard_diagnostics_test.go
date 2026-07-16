package api

import (
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestDiagnosticsJobStore_lifecycle(t *testing.T) {
	s := &diagnosticsJobStore{jobs: map[string]*diagnosticsJob{}}
	creator := &user.SignedInUser{OrgID: 1, UserUID: "creator"}
	someoneElse := &user.SignedInUser{OrgID: 1, UserUID: "someone-else"}

	job := s.create(3, creator)
	require.NotEmpty(t, job.UID)

	snap, ok := s.snapshot(job.UID, creator)
	require.True(t, ok)
	require.Equal(t, jobPending, snap.State)
	require.Equal(t, 3, snap.PanelsTotal)

	s.setProgress(job.UID, 2)
	snap, _ = s.snapshot(job.UID, creator)
	require.Equal(t, 2, snap.PanelsDone)

	// Before completion there is no downloadable archive.
	_, state, ok := s.archiveOf(job.UID, creator)
	require.True(t, ok)
	require.Equal(t, jobPending, state)

	s.complete(job.UID, []byte("archive-bytes"))
	archive, state, ok := s.archiveOf(job.UID, creator)
	require.True(t, ok)
	require.Equal(t, jobComplete, state)
	require.Equal(t, []byte("archive-bytes"), archive)

	// A different identity gets the same "not found" as an unknown UID -- it must not be able to
	// tell the job exists at all, let alone read its status or archive.
	_, ok = s.snapshot(job.UID, someoneElse)
	require.False(t, ok, "a different identity must not see another creator's job")
	_, _, ok = s.archiveOf(job.UID, someoneElse)
	require.False(t, ok, "a different identity must not download another creator's archive")

	// A failed job carries its error and stays without an archive.
	otherJob := s.create(1, creator)
	s.fail(otherJob.UID, errors.New("boom"))
	snap, _ = s.snapshot(otherJob.UID, creator)
	require.Equal(t, jobError, snap.State)
	require.Equal(t, "boom", snap.Err)

	// Unknown UID is reported as not found.
	_, ok = s.snapshot("nope", creator)
	require.False(t, ok)
}

func TestPanelDatasourceUIDs(t *testing.T) {
	q := func(uid string) *simplejson.Json {
		j := simplejson.New()
		if uid != "" {
			j.SetPath([]string{"datasource", "uid"}, uid)
		}
		return j
	}
	req := dtos.MetricRequest{Queries: []*simplejson.Json{q("prom"), q("prom"), q("loki"), q(""), nil}}
	// Deduplicated, in first-seen order; empty/nil entries dropped.
	require.Equal(t, []string{"prom", "loki"}, panelDatasourceUIDs(req))

	require.Empty(t, panelDatasourceUIDs(dtos.MetricRequest{}))
}
