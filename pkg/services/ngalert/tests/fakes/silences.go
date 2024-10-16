package fakes

import (
	"context"

	"golang.org/x/exp/maps"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

type Call struct {
	MethodName string
	Arguments  []interface{}
}

type FakeSilenceStore struct {
	Silences       map[string]*models.Silence
	RuleUIDFolders map[string]string

	RecordedOps []GenericRecordedQuery
}

func (s *FakeSilenceStore) ListSilences(ctx context.Context, orgID int64, filter []string) ([]*models.Silence, error) {
	s.RecordedOps = append(s.RecordedOps, GenericRecordedQuery{"ListSilences", []interface{}{ctx, orgID, filter}})
	return maps.Values(s.Silences), nil
}

func (s *FakeSilenceStore) GetSilence(ctx context.Context, orgID int64, id string) (*models.Silence, error) {
	s.RecordedOps = append(s.RecordedOps, GenericRecordedQuery{"GetSilence", []interface{}{ctx, orgID, id}})
	if silence, ok := s.Silences[id]; ok {
		return silence, nil
	}
	return nil, alertingNotify.ErrSilenceNotFound
}

func (s *FakeSilenceStore) CreateSilence(ctx context.Context, orgID int64, ps models.Silence) (string, error) {
	s.RecordedOps = append(s.RecordedOps, GenericRecordedQuery{"CreateSilence", []interface{}{ctx, orgID, ps}})
	uid := util.GenerateShortUID()
	ps.ID = &uid
	s.Silences[uid] = &ps
	return uid, nil
}

func (s *FakeSilenceStore) UpdateSilence(ctx context.Context, orgID int64, ps models.Silence) (string, error) {
	s.RecordedOps = append(s.RecordedOps, GenericRecordedQuery{"UpdateSilence", []interface{}{ctx, orgID, ps}})
	if _, ok := s.Silences[*ps.ID]; !ok {
		return "", alertingNotify.ErrSilenceNotFound
	}
	s.Silences[*ps.ID] = &ps
	return *ps.ID, nil
}

func (s *FakeSilenceStore) DeleteSilence(ctx context.Context, orgID int64, id string) error {
	s.RecordedOps = append(s.RecordedOps, GenericRecordedQuery{"DeleteSilence", []interface{}{ctx, orgID, id}})
	if _, ok := s.Silences[id]; !ok {
		return alertingNotify.ErrSilenceNotFound
	}
	delete(s.Silences, id)
	return nil
}
