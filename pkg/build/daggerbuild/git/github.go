package git

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
)

// LookupGitHubToken will try to find a GitHub access token that can then be used for various API calls but also cloning of private repositories.
func LookupGitHubToken(ctx context.Context) (string, error) {
	log.Print("Looking for a GitHub token")

	// First try: Check if it's in the environment. This can override everything!
	token := os.Getenv("GITHUB_TOKEN")
	if token != "" {
		log.Print("Using GitHub token provided via environment variable")
		return token, nil
	}

	// Next, check if the user has gh installed and *it* has a token set:
	var data bytes.Buffer
	var errData bytes.Buffer
	ghPath, err := exec.LookPath("gh")
	if err != nil {
		return "", fmt.Errorf("GitHub CLI not installed (expected a --github-token flag, a GITHUB_TOKEN environment variable, or a configured GitHub CLI)")
	}

	//nolint:gosec
	cmd := exec.CommandContext(ctx, ghPath, "auth", "token")
	cmd.Stdout = &data
	cmd.Stderr = &errData

	if err := cmd.Run(); err != nil {
		log.Printf("Querying gh for an access token failed: %s", errData.String())
		return "", fmt.Errorf("lookup in gh failed: %w", err)
	}

	log.Print("Using GitHub token provided via gh")
	return strings.TrimSpace(data.String()), nil
}
