package nanogit

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGithubHTTP(t *testing.T) {
	//owner := os.Args[1]
	//repo := os.Args[2]
	addr := GitAddress{
		Owner: "ryantxu",
		Repo:  "test-repo-export-0003",
	}

	refs, err := ListRefs(addr)
	require.NoError(t, err)

	for _, ref := range refs {
		fmt.Println("ls-refs", ref.Hash, ref.Name)
	}

	branchHash := refs[0].Hash // "f7aceb5288c3937343875a0323cf10fa10ad0f5b" // HEAD branch from above

	listing, err := ReadTree(addr, branchHash)
	require.NoError(t, err)

	out, _ := json.MarshalIndent(listing, "", "  ")
	gpath := "testdata/ryan-test-repo.json"

	// Ignore gosec warning G304 since it's a test
	// nolint:gosec
	golden, _ := os.ReadFile(gpath)

	if !assert.JSONEq(t, string(golden), string(out)) {
		err = os.WriteFile(gpath, out, 0600)
		require.NoError(t, err)
		require.Fail(t, "response changed")
	}

	blobs, err := ReadBody(addr, branchHash,
		"7284ab4d2836271d66b988ae7d037bd6ef0d5d15",
		"6484fb6f9cea3887578def1ba0aa96fcce279f5b",
	)
	require.NoError(t, err)

	for _, node := range blobs {
		fmt.Println("BLOB", node.Hash, len(node.Body), "bytes")
	}

	// Show log messages
	t.FailNow()
}
