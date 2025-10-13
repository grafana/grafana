package dashboard

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGdevReadSummaries(t *testing.T) {
	devdash := "../../../../../devenv/dev-dashboards/panel-graph/"

	ctx := context.Background()
	reader := GetEntitySummaryBuilder()
	failed := make([]string, 0, 10)

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
			return nil
		})
	require.NoError(t, err)

	// accumulated in the walk test
	require.Equal(t, []string{}, failed)
}

func TestReadSummaries(t *testing.T) {
	names := []string{
		"with-library-panels",
	}

	ctx := context.Background()
	reader := GetEntitySummaryBuilder()
	failed := make([]string, 0, 10)

	for _, name := range names {
		fpath := path.Join("testdata", name+".json")
		// Ignore gosec warning G304 since it's a test
		// nolint:gosec
		body, err := os.ReadFile(fpath)
		if err != nil {
			require.NoError(t, err, "error reading: "+fpath)
		}

		summary, _, err := reader(ctx, name, body)
		if err != nil {
			require.NoError(t, err, "error parsing: "+fpath)
		}

		out, err := json.MarshalIndent(summary, "", "  ")
		if err != nil {
			require.NoError(t, err, "error formatting: "+fpath)
		}

		gpath := path.Join("testdata", name+"-info.json")

		// Ignore gosec warning G304 since it's a test
		// nolint:gosec
		golden, _ := os.ReadFile(gpath)

		if !bytes.Equal(out, golden) {
			failed = append(failed, name)
			err = os.WriteFile(gpath, out, 0600)
			if err != nil {
				require.NoError(t, err, "error writing snapshot: "+fpath)
			}
		}
	}

	// accumulated in the walk test
	require.Equal(t, []string{}, failed)
}
