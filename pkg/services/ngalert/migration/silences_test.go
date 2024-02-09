package migration

import (
	"context"
	"fmt"
	"io"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/matttproud/golang_protobuf_extensions/pbutil"
	pb "github.com/prometheus/alertmanager/silence/silencepb"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	legacymodels "github.com/grafana/grafana/pkg/services/alerting/models"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSilences(t *testing.T) {
	t.Run("when some alerts have executionErrorState, create and write silence", func(t *testing.T) {
		withSetting := func(alert *legacymodels.Alert, key, val string) *legacymodels.Alert {
			alert.Settings.Set(key, val)
			return alert
		}

		now = time.Now()
		TimeNow = func() time.Time {
			return now
		}

		o := createOrg(t, 1)
		folder1 := createFolder(t, 1, o.ID, "folder-1")
		dash1 := createDashboard(t, 3, o.ID, "dash1", folder1.UID, folder1.ID, nil)

		silenceTests := []struct {
			name             string
			alerts           []*legacymodels.Alert
			expectedSilences []*pb.MeshSilence
		}{
			{
				name:             "single alert with executionErrorState",
				alerts:           []*legacymodels.Alert{withSetting(createAlert(t, int(o.ID), int(dash1.ID), 1, "alert-1", []string{}), "executionErrorState", "keep_state")},
				expectedSilences: []*pb.MeshSilence{errorSilence()},
			},
			{
				name:             "single alert with noDataState",
				alerts:           []*legacymodels.Alert{withSetting(createAlert(t, int(o.ID), int(dash1.ID), 1, "alert-1", []string{}), "noDataState", "keep_state")},
				expectedSilences: []*pb.MeshSilence{noDataSilence()},
			},
			{
				name: "multiple alerts with both executionErrorState and noDataState",
				alerts: []*legacymodels.Alert{
					withSetting(createAlert(t, int(o.ID), int(dash1.ID), 1, "alert-1", []string{}), "executionErrorState", "keep_state"),
					withSetting(createAlert(t, int(o.ID), int(dash1.ID), 2, "alert-2", []string{}), "noDataState", "keep_state"),
				},
				expectedSilences: []*pb.MeshSilence{errorSilence(), noDataSilence()},
			},
			{
				name: "no alerts with keep_state, no silences",
				alerts: []*legacymodels.Alert{
					createAlert(t, int(o.ID), int(dash1.ID), 1, "alert-1", []string{}),
					createAlert(t, int(o.ID), int(dash1.ID), 2, "alert-2", []string{}),
				},
				expectedSilences: []*pb.MeshSilence{},
			},
		}

		for _, test := range silenceTests {
			t.Run(test.name, func(t *testing.T) {
				sqlStore := db.InitTestDB(t)
				x := sqlStore.GetEngine()

				_, err := x.Insert(o, folder1, dash1)
				require.NoError(t, err)

				_, err = x.Insert(test.alerts)
				require.NoError(t, err)

				cfg := setting.NewCfg()
				cfg.DataPath = "/a/b/c"
				service := NewTestMigrationService(t, sqlStore, cfg)

				sb := stringsBuilderCloser{
					Builder: &strings.Builder{},
				}
				silenceFileAsString := func(filename string) (io.WriteCloser, error) {
					_, err := sb.WriteString(filename)
					require.NoError(t, err)
					return sb, nil
				}
				service.silences.createSilenceFile = silenceFileAsString

				require.NoError(t, service.migrateAllOrgs(context.Background()))

				expectedFilename := ""
				if len(test.expectedSilences) > 0 {
					expectedFilename = cfg.DataPath + "/alerting/1/silences"
					filename := sb.String()[:len(expectedFilename)]
					require.Equal(t, expectedFilename, filename)
				}

				contents := sb.String()[len(expectedFilename):]
				st, err := decodeState(strings.NewReader(contents))
				require.NoError(t, err)
				require.Len(t, st, len(test.expectedSilences))

				silences := make([]*pb.MeshSilence, 0, len(st))
				for _, s := range st {
					silences = append(silences, s)
				}

				cOpt := []cmp.Option{
					cmpopts.SortSlices(func(a, b *pb.MeshSilence) bool { return a.Silence.Comment < b.Silence.Comment }),
					cmpopts.IgnoreUnexported(pb.MeshSilence{}),
					cmpopts.IgnoreFields(pb.Silence{}, "Id"),
				}
				if !cmp.Equal(silences, test.expectedSilences, cOpt...) {
					t.Errorf("Unexpected Silence: %v", cmp.Diff(silences, test.expectedSilences, cOpt...))
				}
			})
		}
	})
}

type stringsBuilderCloser struct {
	*strings.Builder
}

func (s stringsBuilderCloser) Close() error {
	return nil
}

// state copied from prometheus-alertmanager/silence/silence.go.
type state map[string]*pb.MeshSilence

// decodeState copied from prometheus-alertmanager/silence/silence.go.
func decodeState(r io.Reader) (state, error) {
	st := state{}
	for {
		var s pb.MeshSilence
		_, err := pbutil.ReadDelimited(r, &s)
		if err == nil {
			if s.Silence == nil {
				return nil, ErrInvalidState
			}
			st[s.Silence.Id] = &s
			continue
		}
		//nolint:errorlint
		if err == io.EOF {
			break
		}
		return nil, err
	}
	return st, nil
}

var ErrInvalidState = fmt.Errorf("invalid state")
