package codegen

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strconv"

	"cuelang.org/go/cue"
	cueformat "cuelang.org/go/cue/format"
	"github.com/google/go-github/github"
	"golang.org/x/oauth2"
)

const (
	GITHUB_OWNER = "grafana"
	GITHUB_REPO  = "kind-registry"
)

// GetPublishedKind retrieve the latest published kind from the schema registry
func GetPublishedKind(name string, category string) (string, error) {
	token, ok := os.LookupEnv("GITHUB_TOKEN")
	if !ok {
		panic(fmt.Errorf("GITHUB_TOKEN environment variable is missing"))
	}
	ctx := context.Background()
	ts := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: token},
	)
	tc := oauth2.NewClient(ctx, ts)
	client := github.NewClient(tc)

	latestDir, err := findLatestDir(ctx, client)
	if err != nil {
		return "", err
	}

	if latestDir == "" {
		return "", nil
	}

	file, _, _, err := client.Repositories.GetContents(ctx, GITHUB_OWNER, GITHUB_REPO, fmt.Sprintf("grafana/%s/%s/%s.cue", latestDir, category, name), nil)
	if err != nil {
		return "", err
	}
	content, err := file.GetContent()
	if err != nil {
		return "", err
	}

	return content, nil
}

func findLatestDir(ctx context.Context, client *github.Client) (string, error) {
	re := regexp.MustCompile(`([0-9]+)\.([0-9]+)\.([0-9]+)`)
	latestVersion := []uint64{0, 0, 0}
	latestDir := ""

	_, dir, _, err := client.Repositories.GetContents(ctx, GITHUB_OWNER, GITHUB_REPO, "grafana", nil)
	if err != nil {
		return "", err
	}

	for _, content := range dir {
		if content.GetType() != "dir" {
			continue
		}

		parts := re.FindStringSubmatch(content.GetName())
		if parts == nil || len(parts) < 4 {
			continue
		}

		version := make([]uint64, len(parts)-1)
		for i := 1; i < len(parts); i++ {
			version[i-1], _ = strconv.ParseUint(parts[i], 10, 32)
		}

		if isLess(latestVersion, version) {
			latestVersion = version
			latestDir = content.GetName()
		}
	}

	return latestDir, nil
}

func isLess(v1 []uint64, v2 []uint64) bool {
	if len(v1) == 1 || len(v2) == 1 {
		return v1[0] < v2[0]
	}

	return v1[0] < v2[0] || (v1[0] == v2[0] && isLess(v1[2:], v2[2:]))
}

// KindToBytes converts a kind cue value to a .cue file content
func KindToBytes(kind cue.Value) ([]byte, error) {
	node := kind.Syntax(
		cue.All(),
		cue.Schema(),
		cue.Definitions(true),
		cue.Docs(true),
		cue.Hidden(true),
	)

	return cueformat.Node(node)
}
