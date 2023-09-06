package migration

import (
	"testing"

	"github.com/prometheus/alertmanager/silence/silencepb"

	"github.com/grafana/grafana/pkg/infra/log/logtest"
)

// newTestMigration generates an empty migration to use in tests.
func newTestMigration(t *testing.T) *migration {
	t.Helper()

	return &migration{
		log: &logtest.Fake{},
		seenUIDs: uidSet{
			set: make(map[string]struct{}),
		},
		silences: make(map[int64][]*silencepb.MeshSilence),
	}
}
