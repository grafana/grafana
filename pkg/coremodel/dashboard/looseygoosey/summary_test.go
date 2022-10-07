package looseygoosey

import (
	"bytes"
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

func TestReadSummaries(t *testing.T) {
	devdash := "../../../../devenv/dev-dashboards/panel-candlestick/"

	ctx := context.Background()
	reader := NewDashboardSummaryBuilder(dsLookupForTests())
	failed := make([]string, 0, 10)
	table := NewSummaryTable()

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

				uid := path[len(devdash):]
				summary, _, err := reader(ctx, uid, body)
				if err != nil {
					return err
				}
				table.Add(&ObjectInfo{
					UID:  uid,
					Kind: "dashboard",
					Size: int64(len(body)),
				}, summary)

				// Check each snapshot
				if snapshots {
					out, err := json.MarshalIndent(summary, "", "  ")
					if err != nil {
						return err
					}

					gpath := "testdata/gdev-walk-" + strings.ReplaceAll(uid, "/", "-")

					// Ignore gosec warning G304 since it's a test
					// nolint:gosec
					golden, _ := os.ReadFile(gpath)

					if !bytes.Equal(out, golden) {
						failed = append(failed, uid)
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
