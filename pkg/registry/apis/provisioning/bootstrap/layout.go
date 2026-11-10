package bootstrap

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

// Layout is where the bootstrap repositories read from. The two paths are mutually exclusive,
// since both would provision the default org.
type Layout struct {
	// Path is [provisioning] bootstrap_path: one directory, read by the default org's repository.
	Path string
	// OrgsRoot is [provisioning] bootstrap_orgs_path: a root holding one subdirectory per org,
	// named by the org's numeric ID. It is never a repository itself — a repository over it
	// would read every org's subdirectory as its own files.
	OrgsRoot string
	// DefaultOrgID is the org whose repository reads Path.
	DefaultOrgID int64
	// HomePath resolves a relative path, as it does for a repository's own path.
	HomePath string
}

// Enabled reports whether a bootstrap directory is configured.
func (l Layout) Enabled() bool {
	return l.Path != "" || l.OrgsRoot != ""
}

// PermittedPaths returns the prefixes the bootstrap repositories may read.
func (l Layout) PermittedPaths() []string {
	paths := make([]string, 0, 2)
	for _, path := range []string{l.Path, l.OrgsRoot} {
		if path != "" {
			paths = append(paths, l.resolve(path))
		}
	}
	return paths
}

// resolve resolves path exactly as the local resolver resolves a repository's path, so the
// permitted prefix and the paths matched against it are the same strings.
func (l Layout) resolve(path string) string {
	if filepath.IsAbs(path) {
		return safepath.Clean(path)
	}
	return safepath.Join(safepath.Clean(l.HomePath), path)
}

// Resolve returns one Config per org, and the entries under OrgsRoot that name no org. An org
// without a directory gets an empty path, so a repository an earlier run registered is removed
// rather than left reading a directory nothing names anymore.
//
// Orgs that share a namespace are collapsed, since the mapper does that on a cloud stack; two
// of them carrying a directory each is an error, as only one can be provisioned.
func (l Layout) Resolve(orgIDs []int64, namespacer func(int64) string) ([]Config, []string, error) {
	hasDir, unknown, err := l.subdirectories(orgIDs)
	if err != nil {
		return nil, nil, err
	}

	// auto_assign_org_id may name an org that does not exist yet, and bootstrap_path provisions
	// it regardless: a directory nothing reads is the failure this reports loudly instead.
	if l.Path != "" && !slices.Contains(orgIDs, l.DefaultOrgID) {
		orgIDs = append(slices.Clone(orgIDs), l.DefaultOrgID)
	}

	configs := make([]Config, 0, len(orgIDs))
	at := make(map[string]int, len(orgIDs))     // namespace -> index in configs
	from := make(map[string]int64, len(orgIDs)) // namespace -> org whose directory it provisions
	for _, orgID := range orgIDs {
		cfg := Config{Namespace: namespacer(orgID)}
		switch {
		case l.Path != "" && orgID == l.DefaultOrgID:
			cfg.Path = l.Path
		case hasDir[orgID]:
			cfg.Path = safepath.Join(l.OrgsRoot, strconv.FormatInt(orgID, 10))
		}

		i, seen := at[cfg.Namespace]
		switch {
		case !seen:
			at[cfg.Namespace] = len(configs)
			configs = append(configs, cfg)
		case configs[i].Path != "" && cfg.Path != "":
			return nil, nil, fmt.Errorf("orgs %d and %d both have a bootstrap directory but share namespace %q",
				from[cfg.Namespace], orgID, cfg.Namespace)
		case cfg.Path != "":
			configs[i] = cfg
		}
		if cfg.Path != "" {
			from[cfg.Namespace] = orgID
		}
	}
	return configs, unknown, nil
}

// subdirectories reports which orgs have a directory under OrgsRoot, and the entries that name
// no org. A missing root is not an error: the directory is a mount, so it may legitimately be
// absent, and every org then reconciles to a removed repository.
func (l Layout) subdirectories(orgIDs []int64) (map[int64]bool, []string, error) {
	if l.OrgsRoot == "" {
		return nil, nil, nil
	}

	entries, err := os.ReadDir(l.resolve(l.OrgsRoot))
	switch {
	case os.IsNotExist(err):
		return nil, nil, nil
	case err != nil:
		return nil, nil, fmt.Errorf("read bootstrap orgs directory: %w", err)
	}

	byName := make(map[string]int64, len(orgIDs))
	for _, orgID := range orgIDs {
		byName[strconv.FormatInt(orgID, 10)] = orgID
	}

	hasDir := make(map[int64]bool, len(entries))
	var unknown []string
	for _, entry := range entries {
		orgID, ok := byName[entry.Name()]
		if !ok || !entry.IsDir() {
			unknown = append(unknown, entry.Name())
			continue
		}
		hasDir[orgID] = true
	}
	return hasDir, unknown, nil
}
