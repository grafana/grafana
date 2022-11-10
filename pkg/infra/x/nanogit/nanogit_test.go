package nanogit

import (
	"bytes"
	"fmt"
	"log"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

func TestGithubHTTP(t *testing.T) {
	addr := GitAddress{
		Owner: "ryantxu",
		Repo:  "test-repo-export-0003", // also try 3 (much smaller, more duplicates)
	}

	rsp, err := req(addr.Owner, addr.Repo)
	require.NoError(t, err)
	fmt.Printf("INFO:\n=======\n%s\n=======\n", string(rsp))

	refs, err := ListRefs(addr)
	require.NoError(t, err)

	for _, ref := range refs {
		fmt.Println("ls-refs", ref.Hash, ref.Name)
	}

	addr.Branch = refs[0].Hash // "f7aceb5288c3937343875a0323cf10fa10ad0f5b" // HEAD branch from above

	listing, err := GetListing(addr)
	require.NoError(t, err)

	experimental.CheckGoldenJSONFrame(t, "testdata", fmt.Sprintf("list-%s-%s", addr.Owner, addr.Repo), listing, true)

	if true {
		err := ReadBody(addr,
			"7284ab4d2836271d66b988ae7d037bd6ef0d5d15",
			"6484fb6f9cea3887578def1ba0aa96fcce279f5b",
		)
		require.NoError(t, err)
	}

	// Show log messages
	// t.FailNow()
}

func TestOldMain(t *testing.T) {
	t.Skip()

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
		fmt.Println(string(line))
	}

	x, _ := cmd(owner, repo, fmtLines([]string{
		"command=fetch\n",
		"object-format=sha1\n",
		"",
		"thin-pack\n",
		"no-progress\n",
		"ofs-delta\n",
		"deepen 1\n",
		"filter blob:none\n",
		"want 0d7c471c26a54ec4b342b43410f5a715e5a69706\n",
		"done\n",
	}))

	parts, _ := parsePktLine(x)
	for i, p := range parts {
		if string(p) == "packfile\n" {
			file := parts[i+1][1:]
			part2 := parts[i+2][1:]
			part3 := parts[i+3][1:]
			part4 := parts[i+4][1:]
			file = append(file, part2...)
			file = append(file, part3...)
			file = append(file, part4...)

			rr, err := NewPackfileReader(bytes.NewReader(file), 1000000, nil)
			_ = err
			p, err := rr.Read()
			_, _ = p, err
			//for name, t := range p.Trees {
			//fmt.Println("TREE", name)
			//for _, e := range t.Entries {
			//fmt.Println("  ", e.Name)
			//}
			//}
		}
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
		"shallow 0d7c471c26a54ec4b342b43410f5a715e5a69706\n",
		"want 11b705c82e41e153ac3cfad309ee9f73aed2d123\n",
		"want 3da6e16a0f3619bb29f6349c2868a27670a271f7\n",
		"want 526a7c115109b9d22e906a52938df7fbd35ee922\n",
		"want 8c920824c3cc1d1e2238874b64cfd0473748bbfa\n",
		"want abeace67817bec04bfbc7ed49a22120eaf5784c6\n",
		"want d3ca725d7d1331c113007a16f043d058da4f2755\n",
		"want d40feaa035c972f1f4ba7cc8d33010d258027884\n",
		"want f229374dc16f1e27b2205d3f9976dca852a17c17\n",
		"done\n",
	}))

	parts, _ = parsePktLine(z)
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
			for name := range p.Blobs {
				fmt.Println("BLOB", name, len(cache[name]), "bytes")
			}
		}
	}
	fmt.Println("Transferred bytes:", len(x)+len(z))

	// Show log messages
	t.FailNow()
}
