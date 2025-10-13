package search_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func TestUserDocumentBuilder(t *testing.T) {
	info, err := search.GetUserBuilder()
	require.NoError(t, err)
	require.NotNil(t, info.Builder)

	builder := info.Builder

	base := filepath.Join("testdata", "doc")
	inPath := filepath.Join(base, "user-example.json")
	outPath := filepath.Join(base, "user-example-out.json")

	// nolint:gosec
	raw, err := os.ReadFile(inPath)
	if err != nil {
		t.Fatalf("missing input fixture %s: %v", inPath, err)
	}

	gr := iamv0.UserResourceInfo.GroupResource()
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     gr.Group,
		Resource:  gr.Resource,
		Name:      "example", // set by input file metadata.name
	}

	doc, err := builder.BuildDocument(context.Background(), key, 1234, raw)
	require.NoError(t, err)
	require.NotNil(t, doc)

	// Core
	require.Equal(t, key.Name, doc.Name)
	require.Equal(t, int64(1234), doc.RV)
	require.Equal(t, key, doc.Key)
	require.Equal(t, key.Name, doc.Title)

	// Custom field assertions (email/login added to Fields)
	if assert.NotNil(t, doc.Fields) {
		assert.Equal(t, "example@example.com", doc.Fields[search.USER_EMAIL])
		assert.Equal(t, "example", doc.Fields[search.USER_LOGIN])
	}

	// Snapshot compare
	out, err := json.MarshalIndent(doc, "", "  ")
	require.NoError(t, err)

	// nolint:gosec
	expected, readErr := os.ReadFile(outPath)
	if readErr != nil {
		err2 := os.MkdirAll(filepath.Dir(outPath), 0o755)
		require.NoError(t, err2)
		err2 = os.WriteFile(outPath, out, 0o600)
		require.NoError(t, err2)
		t.Fatalf("snapshot created at %s; re-run tests", outPath)
	}
	assert.JSONEq(t, string(expected), string(out))
}
