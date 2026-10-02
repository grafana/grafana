package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"os"
	"os/exec"
	"path"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

const approvalLabel = "re-embed-approved"

type resourceID struct {
	group    string
	resource string
}

type versions map[resourceID]int64

func main() {
	base := flag.String("base", "", "PR base commit")
	head := flag.String("head", "HEAD", "PR head commit")
	repo := flag.String("repo", ".", "Git repository")
	event := flag.String("event", os.Getenv("GITHUB_EVENT_PATH"), "GitHub pull_request event JSON")
	flag.Parse()
	if err := run(*repo, *base, *head, *event, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(repo, base, head, event string, out io.Writer) error {
	if base == "" || event == "" {
		return fmt.Errorf("--base and --event are required")
	}
	data, err := os.ReadFile(event)
	if err != nil {
		return err
	}
	var payload struct {
		PullRequest *struct {
			Labels []struct {
				Name string `json:"name"`
			} `json:"labels"`
		} `json:"pull_request"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return fmt.Errorf("read PR labels: %w", err)
	}
	if payload.PullRequest == nil {
		return fmt.Errorf("event does not contain a pull_request")
	}
	approved := false
	for _, label := range payload.PullRequest.Labels {
		approved = approved || label.Name == approvalLabel
	}

	// Compare the changes introduced by this PR, even when main has advanced.
	ancestor, err := git(repo, "merge-base", base, head)
	if err != nil {
		return err
	}
	before, err := readVersions(repo, strings.TrimSpace(string(ancestor)))
	if err != nil {
		return err
	}
	after, err := readVersions(repo, head)
	if err != nil {
		return err
	}
	return checkApproval(before, after, approved, out)
}

func git(repo string, args ...string) ([]byte, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = repo
	result, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git %s: %w", strings.Join(args, " "), err)
	}
	return result, nil
}

func readVersions(repo, revision string) (versions, error) {
	files, err := git(repo, "ls-tree", "-r", "--name-only", "-z", revision)
	if err != nil {
		return nil, err
	}
	result := versions{}
	for file := range strings.SplitSeq(string(files), "\x00") {
		name := path.Base(file)
		if (name != "manifest.go" && !strings.HasSuffix(name, "_manifest.go")) || strings.Contains("/"+file, "/testdata/") {
			continue
		}
		source, err := git(repo, "show", revision+":"+file)
		if err != nil {
			return nil, err
		}
		entries, err := parseManifest(file, source)
		if err != nil {
			return nil, fmt.Errorf("%s:%s: %w", revision, file, err)
		}
		for id, version := range entries {
			if existing, ok := result[id]; ok && existing != version {
				return nil, fmt.Errorf("%s: conflicting re-embedding versions for %s/%s", revision, id.group, id.resource)
			}
			result[id] = version
		}
	}
	return result, nil
}

func parseManifest(filename string, source []byte) (versions, error) {
	file, err := parser.ParseFile(token.NewFileSet(), filename, source, 0)
	if err != nil {
		return nil, err
	}
	appAlias := ""
	for _, imp := range file.Imports {
		name, err := strconv.Unquote(imp.Path.Value)
		if err == nil && name == "github.com/grafana/grafana-app-sdk/app" {
			appAlias = "app"
			if imp.Name != nil {
				appAlias = imp.Name.Name
			}
		}
	}
	result := versions{}
	ast.Inspect(file, func(node ast.Node) bool {
		if err != nil {
			return false
		}
		manifest, ok := node.(*ast.CompositeLit)
		if !ok {
			return true
		}
		kind, ok := manifest.Type.(*ast.SelectorExpr)
		if !ok || kind.Sel.Name != "ManifestData" {
			return true
		}
		pkg, ok := kind.X.(*ast.Ident)
		if !ok || pkg.Name != appAlias {
			return true
		}
		embed := field(manifest, "Embed")
		if embed == nil {
			return false
		}
		if ident, ok := embed.(*ast.Ident); ok && ident.Name == "nil" {
			return false
		}
		entries, ok := embed.(*ast.CompositeLit)
		if !ok {
			err = fmt.Errorf("root Embed must be a map literal")
			return false
		}
		group, groupErr := stringLiteral(field(manifest, "Group"))
		if groupErr != nil {
			err = fmt.Errorf("manifest Group: %w", groupErr)
			return false
		}
		for _, entry := range entries.Elts {
			pair, ok := entry.(*ast.KeyValueExpr)
			if !ok {
				err = fmt.Errorf("root Embed entry must have a resource key")
				return false
			}
			resource, resourceErr := stringLiteral(pair.Key)
			if resourceErr != nil {
				err = fmt.Errorf("root Embed resource: %w", resourceErr)
				return false
			}
			declaration, ok := pair.Value.(*ast.CompositeLit)
			if !ok {
				err = fmt.Errorf("root Embed[%q] must be a struct literal", resource)
				return false
			}
			version := int64(0)
			if value := field(declaration, "ReembedVersion"); value != nil {
				literal, ok := value.(*ast.BasicLit)
				if !ok || literal.Kind != token.INT {
					err = fmt.Errorf("root Embed[%q].ReembedVersion must be an integer literal", resource)
					return false
				}
				version, err = strconv.ParseInt(literal.Value, 0, 64)
				if err != nil {
					return false
				}
			}
			id := resourceID{group, resource}
			if existing, ok := result[id]; ok && existing != version {
				err = fmt.Errorf("conflicting re-embedding versions for %s/%s", group, resource)
				return false
			}
			result[id] = version
		}
		return false
	})
	return result, err
}

func field(literal *ast.CompositeLit, name string) ast.Expr {
	for _, element := range literal.Elts {
		if pair, ok := element.(*ast.KeyValueExpr); ok {
			if key, ok := pair.Key.(*ast.Ident); ok && key.Name == name {
				return pair.Value
			}
		}
	}
	return nil
}

func stringLiteral(expr ast.Expr) (string, error) {
	if literal, ok := expr.(*ast.BasicLit); ok && literal.Kind == token.STRING {
		return strconv.Unquote(literal.Value)
	}
	return "", fmt.Errorf("expected a string literal")
}

var nonAlphanumeric = regexp.MustCompile(`[^a-zA-Z0-9]`)

func checkApproval(before, after versions, approved bool, out io.Writer) error {
	var increases []resourceID
	for id, version := range after {
		if old, exists := before[id]; exists && version > old {
			increases = append(increases, id)
		}
	}
	slices.SortFunc(increases, func(a, b resourceID) int {
		return strings.Compare(a.group+"/"+a.resource, b.group+"/"+b.resource)
	})
	if len(increases) == 0 {
		fmt.Fprintln(out, "No existing resource re-embedding versions increased.")
		return nil
	}
	fmt.Fprintln(out, "These version increases can trigger re-embedding across deployed instances where each resource is enrolled:")
	for _, id := range increases {
		// Match vector.InternalPartitionKey without importing the storage backend.
		partition := strings.ToLower(nonAlphanumeric.ReplaceAllString(id.resource, "_"))
		fmt.Fprintf(out, "  %s/%s: %d -> %d\n", id.group, id.resource, before[id], after[id])
		fmt.Fprintf(out, "    sum(grafana_vector_storage_embeddings_stored{resource=%q})\n", partition)
	}
	fmt.Fprintln(out, "The gauge counts embedding rows, not resources. Use the relevant deployment's metrics for sizing; metrics access is not required by this check.")
	if !approved {
		return fmt.Errorf("review the re-embedding scope and cost, then have a maintainer add the %q PR label to approve these increases", approvalLabel)
	}
	fmt.Fprintf(out, "Approval label %q is present.\n", approvalLabel)
	return nil
}
