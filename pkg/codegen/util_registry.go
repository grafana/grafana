package codegen

import (
	"context"
	"fmt"
	"net/http"
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
func GetPublishedKind(name string, category string, latestRegistryDir string) (string, error) {
	ctx := context.Background()
	tc := oauth2.NewClient(ctx, nil)
	client := github.NewClient(tc)

	if latestRegistryDir == "" {
		return "", nil
	}

	file, _, resp, err := client.Repositories.GetContents(ctx, GITHUB_OWNER, GITHUB_REPO, fmt.Sprintf("grafana/%s/%s/%s.cue", latestRegistryDir, category, name), nil)
	if err != nil {
		if resp.StatusCode == http.StatusNotFound {
			return "", nil
		}
		return "", fmt.Errorf("error retrieving published kind from GH, %d: %w", resp.StatusCode, err)
	}
	content, err := file.GetContent()
	if err != nil {
		return "", fmt.Errorf("error decoding published kind content: %w", err)
	}

	return content, nil
}

func FindLatestDir(ctx context.Context, client *github.Client) (string, error) {
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
