package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func manifest(group, entries string) string {
	return fmt.Sprintf(`package manifestdata
import sdk "github.com/grafana/grafana-app-sdk/app"
var data = sdk.ManifestData{
    Group: %q,
    Embed: map[string]sdk.ManifestResourceEmbed{%s},
    Versions: []sdk.ManifestVersion{{Name: "v1"}},
}
`, group, entries)
}

func TestApproval(t *testing.T) {
	for _, tc := range []struct {
		name, before, after string
		approved, wantError bool
	}{
		{"unapproved increase", `"folders": {ReembedVersion: 1}`, `"folders": {ReembedVersion: 2}`, false, true},
		{"approved increase", `"folders": {ReembedVersion: 1}`, `"folders": {ReembedVersion: 2}`, true, false},
		{"unchanged", `"folders": {ReembedVersion: 2}`, `"folders": {ReembedVersion: 2}`, false, false},
		{"decreased", `"folders": {ReembedVersion: 2}`, `"folders": {ReembedVersion: 1}`, false, false},
		{"new entry", "", `"folders": {ReembedVersion: 9}`, false, false},
		{"removed entry", `"folders": {ReembedVersion: 2}`, "", false, false},
		{"renamed resource is new", `"folders": {ReembedVersion: 1}`, `"playlists": {ReembedVersion: 2}`, false, false},
		{"reordered", `"folders": {ReembedVersion: 1}, "playlists": {ReembedVersion: 2}`, `"playlists": {ReembedVersion: 2}, "folders": {ReembedVersion: 1}`, false, false},
		{"formatted", `"folders": {ReembedVersion: 1}`, "\n\t`folders`: sdk.ManifestResourceEmbed{\n// comment\nReembedVersion: 0x1,\n},\n", false, false},
		{"reordered increase", `"folders": {ReembedVersion: 1}, "playlists": {ReembedVersion: 2}`, `"playlists": {ReembedVersion: 3}, "folders": {ReembedVersion: 1}`, false, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := parse(t, manifest("folder.grafana.app", tc.before))
			after := parse(t, manifest("folder.grafana.app", tc.after))
			var out bytes.Buffer
			err := checkApproval(before, after, tc.approved, &out)
			if (err != nil) != tc.wantError {
				t.Fatalf("error = %v, want error %v; output: %s", err, tc.wantError, &out)
			}
			if tc.wantError && !strings.Contains(err.Error(), approvalLabel) {
				t.Fatalf("missing approval instruction: %v", err)
			}
		})
	}
}

func TestCostOutputAndResourceIdentity(t *testing.T) {
	before := versions{{"a.grafana.app", "Panel-Groups"}: 1, {"b.grafana.app", "Panel-Groups"}: 8}
	after := versions{{"a.grafana.app", "Panel-Groups"}: 2, {"b.grafana.app", "Panel-Groups"}: 9, {"new.grafana.app", "folders"}: 10}
	var out bytes.Buffer
	if err := checkApproval(before, after, false, &out); err == nil {
		t.Fatal("expected approval failure")
	}
	for _, expected := range []string{
		"a.grafana.app/Panel-Groups: 1 -> 2",
		"b.grafana.app/Panel-Groups: 8 -> 9",
		`sum(grafana_vector_storage_embeddings_stored{resource="panel_groups"})`,
		"across deployed instances",
		"embedding rows, not resources",
	} {
		if !strings.Contains(out.String(), expected) {
			t.Errorf("output missing %q: %s", expected, &out)
		}
	}
	if strings.Contains(out.String(), "new.grafana.app") {
		t.Fatalf("new group must not require approval: %s", &out)
	}
}

func TestManifestIgnoresUnrelatedEdits(t *testing.T) {
	before := manifest("folder.grafana.app", `"folders": {ReembedVersion: 1}`)
	after := strings.ReplaceAll(before, `Name: "v1"`, `Name: "v2", Kinds: []sdk.ManifestVersionKind{{Embed: &sdk.ManifestVersionKindEmbed{Fields: []sdk.ManifestVersionKindEmbedField{{Name: "title", Path: "spec.changed"}}}}}`)
	after += "\nconst extractorVersion = 99\nfunc NewUnrelatedThing() {}\n"
	var out bytes.Buffer
	if err := checkApproval(parse(t, before), parse(t, after), false, &out); err != nil {
		t.Fatal(err)
	}
	for _, source := range []string{
		`package other; const extractorVersion = 2`,
		`package other; import "github.com/grafana/grafana-app-sdk/app"; var x = app.ManifestData{Group: "g", Embed: nil}`,
		`package other; import "github.com/grafana/grafana-app-sdk/app"; var x = app.ManifestData{Group: "g"}`,
	} {
		if got := parse(t, source); len(got) != 0 {
			t.Fatalf("unexpected declarations: %v", got)
		}
	}
}

func TestUnsupportedDeclarationsFail(t *testing.T) {
	for _, entries := range []string{
		`"folders": {ReembedVersion: versionConstant}`,
		`"folders": declarationVariable`,
		`resourceName: {ReembedVersion: 2}`,
		`"folders": {ReembedVersion: 18446744073709551616}`,
	} {
		if _, err := parseManifest("test_manifest.go", []byte(manifest("group", entries))); err == nil {
			t.Errorf("unsupported declaration silently accepted: %s", entries)
		}
	}
}

func parse(t *testing.T, source string) versions {
	t.Helper()
	got, err := parseManifest("test_manifest.go", []byte(source))
	if err != nil {
		t.Fatal(err)
	}
	return got
}

func TestGitComparisonAndLabels(t *testing.T) {
	repo := t.TempDir()
	gitTest(t, repo, "init", "-q")
	gitTest(t, repo, "config", "user.email", "test@example.invalid")
	gitTest(t, repo, "config", "user.name", "Test")
	gitTest(t, repo, "config", "commit.gpgsign", "false")
	gitTest(t, repo, "config", "core.hooksPath", "/dev/null")
	original := "apps/folder/pkg/old_manifest.go"
	write(t, filepath.Join(repo, original), manifest("folder.grafana.app", `"folders": {ReembedVersion: 1}`))
	gitTest(t, repo, "add", ".")
	gitTest(t, repo, "commit", "-qm", "base")
	base := strings.TrimSpace(gitTest(t, repo, "rev-parse", "HEAD"))

	// Rename the generated file: identity is group/resource rather than path.
	if err := os.Remove(filepath.Join(repo, original)); err != nil {
		t.Fatal(err)
	}
	write(t, filepath.Join(repo, "apps/folder/pkg/manifest.go"), manifest("folder.grafana.app", `"folders": {ReembedVersion: 2}`))
	write(t, filepath.Join(repo, "apps/another/pkg/app_manifest.go"), manifest("another.grafana.app", `"folders": {ReembedVersion: 9}`))
	write(t, filepath.Join(repo, "pkg/testdata/test_manifest.go"), "invalid fixture, not a deployed declaration")
	gitTest(t, repo, "add", "-A")
	gitTest(t, repo, "commit", "-qm", "head")
	head := strings.TrimSpace(gitTest(t, repo, "rev-parse", "HEAD"))

	for _, labels := range [][]string{nil, {approvalLabel}, {"re-embed-approved-extra"}, nil} {
		event := filepath.Join(t.TempDir(), "event.json")
		values := make([]map[string]string, 0, len(labels))
		for _, label := range labels {
			values = append(values, map[string]string{"name": label})
		}
		body, err := json.Marshal(map[string]any{"pull_request": map[string]any{"labels": values}})
		if err != nil {
			t.Fatal(err)
		}
		write(t, event, string(body))
		var out bytes.Buffer
		err = run(repo, base, head, event, &out)
		approved := len(labels) == 1 && labels[0] == approvalLabel
		if (err == nil) != approved {
			t.Fatalf("labels %v: error %v; output: %s", labels, err, &out)
		}
		if !strings.Contains(out.String(), "folder.grafana.app/folders: 1 -> 2") {
			t.Fatalf("missing renamed resource increase: %s", &out)
		}
	}

	// An unrelated increase on the base branch must not be attributed to this PR.
	gitTest(t, repo, "checkout", "-q", "-b", "advanced-main", base)
	write(t, filepath.Join(repo, "apps/another/pkg/app_manifest.go"), manifest("another.grafana.app", `"folders": {ReembedVersion: 1}`))
	gitTest(t, repo, "add", ".")
	gitTest(t, repo, "commit", "-qm", "advance main")
	advanced := strings.TrimSpace(gitTest(t, repo, "rev-parse", "HEAD"))
	event := filepath.Join(t.TempDir(), "event.json")
	write(t, event, `{"pull_request":{"labels":[{"name":"re-embed-approved"}]}}`)
	var out bytes.Buffer
	if err := run(repo, advanced, head, event, &out); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out.String(), "another.grafana.app") {
		t.Fatalf("new PR entry compared against unrelated main change: %s", &out)
	}
	for _, invalid := range []string{`{`, `{}`} {
		write(t, event, invalid)
		if err := run(repo, base, head, event, &out); err == nil {
			t.Fatalf("invalid event accepted: %s", invalid)
		}
	}
}

func write(t *testing.T, file, text string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(file, []byte(text), 0o600); err != nil {
		t.Fatal(err)
	}
}

func gitTest(t *testing.T, repo string, args ...string) string {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = repo
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v: %s", args, err, out)
	}
	return string(out)
}
