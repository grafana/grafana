package nanogit

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGithubHTTP(t *testing.T) {
	//owner := os.Args[1]
	//repo := os.Args[2]
	owner, repo := "ryantxu", "test-repo-export-0002"
	_, _ = owner, repo

	// Get all refs from the server
	refsData, err := cmd(owner, repo, fmtLines([]string{
		"command=ls-refs\n",
		"object-format=sha1\n",
	}))
	if err != nil {
		log.Fatal(err)
	}
	lines, _ := parsePktLine(refsData)
	for _, line := range lines {
		fmt.Println("ls-refs", string(line))
	}

	branchHash := "0d7c471c26a54ec4b342b43410f5a715e5a69706" // HEAD branch from above

	listing, err := ReadTree(GitAddress{
		Owner: "ryantxu",
		Repo:  "test-repo-export-0002",
	}, branchHash)
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

	z, _ := cmd("ryantxu", "test-repo-export-0002", fmtLines([]string{
		"command=fetch\n",
		"object-format=sha1\n",
		"",
		"thin-pack\n",
		"no-progress\n",
		"ofs-delta\n",
		"deepen 1\n",
		"filter blob:none\n",
		"shallow " + branchHash + "\n",
		"want 082b60d653e7f7a021fd36a962081e5ecb1016fe\n",
		// "want 526a7c115109b9d22e906a52938df7fbd35ee922\n",
		// "want 8c920824c3cc1d1e2238874b64cfd0473748bbfa\n",
		// "want abeace67817bec04bfbc7ed49a22120eaf5784c6\n",
		// "want d3ca725d7d1331c113007a16f043d058da4f2755\n",
		// "want d40feaa035c972f1f4ba7cc8d33010d258027884\n",
		// "want f229374dc16f1e27b2205d3f9976dca852a17c17\n",
		"done\n",
	}))

	parts, _ := parsePktLine(z)
	for i, p := range parts {
		if string(p) == "packfile\n" {
			file := parts[i+1][1:]
			part2 := parts[i+2][1:]
			file = append(file, part2...)

			cache := map[string][]byte{}
			rr, _ := NewPackfileReader(bytes.NewReader(file), 1000000, func(hash string, content []byte) {
				cache[hash] = content
			})
			p, _ := rr.Read()
			for k, v := range p.Commits {
				fmt.Println("COMIT", k, v.Author)
			}

			for name, _ := range p.Blobs {
				fmt.Println("BLOB", name, len(cache[name]), "bytes")
				//fmt.Println(">", string(cache[name]))
			}
		}
	}
	fmt.Println("Transferred bytes:", len(z))

	// Show log messages
	t.FailNow()
}
