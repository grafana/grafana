package migration

import (
	"testing"

	"github.com/prometheus/alertmanager/silence/silencepb"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
	fake_secrets "github.com/grafana/grafana/pkg/services/secrets/fakes"
)

// newTestMigration generates an empty migration to use in tests.
func newTestMigration(t *testing.T) *migration {
	t.Helper()

	return &migration{
		log: &logtest.Fake{},
		seenUIDs: uidSet{
			set: make(map[string]struct{}),
		},
		silences:          make(map[int64][]*silencepb.MeshSilence),
		encryptionService: fake_secrets.NewFakeSecretsService(),
	}
}
