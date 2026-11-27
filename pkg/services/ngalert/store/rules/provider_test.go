package rules

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/store/provenance"
	"github.com/grafana/grafana/pkg/setting"
)

type folderRegistrationSpy struct {
	folder.Service
	calls int
	err   error
}

func (s *folderRegistrationSpy) RegisterService(folder.RegistryService) error {
	s.calls++
	return s.err
}

func TestProvideRuleStore_doesNotRegisterAndPreservesNilDatabaseProvider(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.UnifiedAlerting.BaseInterval = 17
	folders := &folderRegistrationSpy{err: errors.New("must not register SQL directly")}
	provenances := &provenance.ProvenanceStore{}
	store, err := ProvideRuleStore(cfg, featuremgmt.WithFeatures(), nil, folders, nil, provenances)
	require.NoError(t, err)
	require.Equal(t, cfg.UnifiedAlerting, store.Cfg)
	require.Same(t, folders, store.FolderService)
	require.Same(t, provenances, store.Provenance)
	require.Nil(t, store.LegacyDatabaseProvider)
	require.Zero(t, folders.calls)
}
