package object

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/services/searchV2/dslookup"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/stretchr/testify/require"
)

func dsLookup() dslookup.DatasourceLookup {
	return dslookup.CreateDatasourceLookup([]*dslookup.DatasourceQueryResult{
		{
			UID:       "P8045C56BDA891CB2",
			Type:      "cloudwatch",
			Name:      "cloudwatch-name",
			IsDefault: false,
		},
		{
			UID:       "default.uid",
			Type:      "default.type",
			Name:      "default.name",
			IsDefault: true,
		},
	})
}

func TestReadDashboard(t *testing.T) {
	devdash := "../../../../devenv/dev-dashboards/"

	reader := NewDashboardSummaryBuilder(dsLookup())
	failed := make([]string, 0, 10)
	table := newSummaryTable()

	snapshots := false

	err := filepath.Walk(devdash,
		func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			if !info.IsDir() && strings.HasSuffix(path, ".json") {
				// Ignore gosec warning G304 since it's a test
				// nolint:gosec
				body, err := os.ReadFile(path)
				if err != nil {
					return err
				}

				obj := &object.RawObject{
					UID:      path[len(devdash):],
					Size:     info.Size(),
					Modified: info.ModTime().UnixMilli(),
					Body:     body,
					ETag:     createContentsHash(body),
				}

				summary, err := reader(obj)
				if err != nil {
					return err
				}
				table.Add(obj, summary)

				// Check each snapshot
				if snapshots {
					out, err := json.MarshalIndent(summary, "", "  ")
					if err != nil {
						return err
					}

					gpath := "testdata/gdev-walk-" + strings.ReplaceAll(obj.UID, "/", "-")

					// Ignore gosec warning G304 since it's a test
					// nolint:gosec
					golden, _ := os.ReadFile(gpath)

					if !bytes.Equal(out, golden) {
						failed = append(failed, obj.UID)
						err = os.WriteFile(gpath, out, 0600)
						if err != nil {
							return err
						}
					}
				}
			}
			return nil
		})
	require.NoError(t, err)

	// Check the tabular formts
	experimental.CheckGoldenJSONFrame(t, "testdata", "dash_raw", table.Raw, true)
	experimental.CheckGoldenJSONFrame(t, "testdata", "dash_summary", table.Summary, true)
	experimental.CheckGoldenJSONFrame(t, "testdata", "dash_references", table.References, true)
	experimental.CheckGoldenJSONFrame(t, "testdata", "dash_labels", table.Labels, true)

	// accumulated in the walk test
	require.Equal(t, []string{}, failed)
}

func createContentsHash(contents []byte) string {
	hash := md5.Sum(contents)
	return hex.EncodeToString(hash[:])
}
