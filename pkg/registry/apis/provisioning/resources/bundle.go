package resources

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/gobwas/glob"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/sets"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
)

const (
	// BundleMaxFiles caps how many files one bundle may resolve to. The cap is what keeps
	// the resolved set small enough to list in the owning resource's status, which is
	// where a consumer reads it from.
	BundleMaxFiles = 128
	// BundleMaxSelectors caps how many named parts a bundle may declare.
	BundleMaxSelectors = 32
	// bundleMaxSelectorName caps a selector name, which is a map key in the API.
	bundleMaxSelectorName = 63
)

// bundleFilesField is the top-level field a bundle declares its file set in. It is a
// sibling of spec rather than part of it: which files belong to a resource is a
// provisioning concern, so it must not collide with the kind's own schema.
var bundleFilesField = []string{"files"}

// globSeparator makes "*" stop at a path separator while "**" crosses it.
const globSeparator = '/'

// patternMeta are the characters that make a path a pattern rather than a literal.
const patternMeta = `*?[]{}!\`

var (
	// ErrBundleFilesType reports a files block that is not a map of selectors.
	ErrBundleFilesType = errors.New("files must be a map of named selectors")
	// ErrBundleTooManySelectors reports more than BundleMaxSelectors named parts.
	ErrBundleTooManySelectors = fmt.Errorf("a bundle may declare at most %d named parts", BundleMaxSelectors)
	// ErrBundleTooManyFiles reports a resolution exceeding BundleMaxFiles.
	ErrBundleTooManyFiles = fmt.Errorf("a bundle may resolve to at most %d files", BundleMaxFiles)
	// ErrBundleSelectorName reports an unusable selector name.
	ErrBundleSelectorName = errors.New("a bundle part name must be 1-63 characters of lowercase letters, numbers or hyphens")
	// ErrBundleSelectorEmpty reports a selector declaring neither path nor include.
	ErrBundleSelectorEmpty = errors.New("a bundle part must declare either path or include")
	// ErrBundleSelectorAmbiguous reports a selector declaring both path and include.
	ErrBundleSelectorAmbiguous = errors.New("a bundle part must declare path or include, not both")
	// ErrBundleSelectorUnrooted reports a pattern whose first segment is not a literal.
	// An unrooted pattern would sweep the repository and claim every other bundle's files.
	ErrBundleSelectorUnrooted = errors.New("an include pattern must start with a literal path segment")
	// ErrBundleSelectorPattern reports a pattern that does not compile.
	ErrBundleSelectorPattern = errors.New("invalid include or exclude pattern")
	// ErrBundleFileIsManifest reports a selector matching the bundle's own manifest.
	ErrBundleFileIsManifest = errors.New("a bundle cannot claim its own manifest")
)

// BundleSelectorError reports an invalid named part, naming it so the caller can surface
// which entry failed without re-deriving it.
type BundleSelectorError struct {
	// Name is the selector's key in the files block.
	Name string
	Err  error
}

func (e *BundleSelectorError) Error() string {
	return fmt.Sprintf("bundle part %q is not valid: %v", e.Name, e.Err)
}

func (e *BundleSelectorError) Unwrap() error { return e.Err }

// BundleSelector declares one named part of a bundle's file set: either a single exact
// path, or an include pattern narrowed by excludes.
type BundleSelector struct {
	// Name is the key this part was declared under. Consumers reference a part by name
	// rather than by path, so moving a file does not rewrite the resource.
	Name string
	// Path names exactly one file. Mutually exclusive with Include.
	Path string
	// Include is a glob matched against repository paths. "*" stops at a separator,
	// "**" crosses it.
	Include string
	// Exclude narrows Include. Ignored when Path is set.
	Exclude []string

	include glob.Glob
	exclude []glob.Glob
}

// IsPattern reports whether the part selects by pattern rather than by exact path.
func (s BundleSelector) IsPattern() bool { return s.Include != "" }

// matches reports whether path is selected by this part.
func (s BundleSelector) matches(path string) bool {
	if !s.IsPattern() {
		return path == s.Path
	}
	if !s.include.Match(path) {
		return false
	}
	for _, ex := range s.exclude {
		if ex.Match(path) {
			return false
		}
	}
	return true
}

// patternRoot returns the literal prefix of a pattern: every leading segment that
// contains no pattern metacharacter. It is empty for an unrooted pattern.
func patternRoot(pattern string) string {
	segments := strings.Split(pattern, "/")
	literal := make([]string, 0, len(segments))
	for _, segment := range segments {
		if strings.ContainsAny(segment, patternMeta) {
			break
		}
		literal = append(literal, segment)
	}
	return strings.Join(literal, "/")
}

// ParseBundleSelectors reads and statically validates the file set a bundle declares in
// its top-level files block.
//
// Validation here is everything checkable from the manifest alone: names, the
// path-or-include choice, pattern syntax, and that patterns are rooted. What a part
// actually matches needs a listing of the repository at a ref, which Parse does not have;
// see ResolveBundleFiles.
//
// Paths and pattern roots are repository-root-relative, matching every other path in
// provisioning, so a part may select files that do not sit beside the manifest. They are
// deliberately not checked against the resource extensions: carrying files the resource
// pipeline cannot parse is the point of a bundle.
//
// A bundle with no files block is valid and returns no parts.
func ParseBundleSelectors(obj *unstructured.Unstructured, manifestPath string) ([]BundleSelector, error) {
	if obj == nil {
		return nil, nil
	}

	raw, found, err := unstructured.NestedFieldNoCopy(obj.Object, bundleFilesField...)
	if err != nil {
		return nil, ErrBundleFilesType
	}
	if !found || raw == nil {
		return nil, nil
	}

	entries, ok := raw.(map[string]any)
	if !ok {
		return nil, ErrBundleFilesType
	}
	if len(entries) > BundleMaxSelectors {
		return nil, ErrBundleTooManySelectors
	}

	names := make([]string, 0, len(entries))
	for name := range entries {
		names = append(names, name)
	}
	// Sorted so a bundle's parts are processed in a stable order, which keeps both
	// validation errors and the attribution of an overlapping path deterministic.
	sort.Strings(names)

	selectors := make([]BundleSelector, 0, len(entries))
	for _, name := range names {
		selector, err := parseBundleSelector(name, entries[name], manifestPath)
		if err != nil {
			return nil, err
		}
		selectors = append(selectors, selector)
	}

	return selectors, nil
}

func parseBundleSelector(name string, raw any, manifestPath string) (BundleSelector, error) {
	selector := BundleSelector{Name: name}

	if !isValidSelectorName(name) {
		return selector, &BundleSelectorError{Name: name, Err: ErrBundleSelectorName}
	}

	fields, ok := raw.(map[string]any)
	if !ok {
		return selector, &BundleSelectorError{Name: name, Err: ErrBundleFilesType}
	}

	var err error
	if selector.Path, err = optionalString(fields, "path"); err != nil {
		return selector, &BundleSelectorError{Name: name, Err: err}
	}
	if selector.Include, err = optionalString(fields, "include"); err != nil {
		return selector, &BundleSelectorError{Name: name, Err: err}
	}
	if selector.Exclude, err = optionalStringSlice(fields, "exclude"); err != nil {
		return selector, &BundleSelectorError{Name: name, Err: err}
	}

	switch {
	case selector.Path == "" && selector.Include == "":
		return selector, &BundleSelectorError{Name: name, Err: ErrBundleSelectorEmpty}
	case selector.Path != "" && selector.Include != "":
		return selector, &BundleSelectorError{Name: name, Err: ErrBundleSelectorAmbiguous}
	}

	if !selector.IsPattern() {
		if err := validatePathBasics(selector.Path); err != nil {
			return selector, &BundleSelectorError{Name: name, Err: err}
		}
		if selector.Path == manifestPath {
			return selector, &BundleSelectorError{Name: name, Err: ErrBundleFileIsManifest}
		}
		return selector, nil
	}

	root := patternRoot(selector.Include)
	if root == "" {
		return selector, &BundleSelectorError{Name: name, Err: ErrBundleSelectorUnrooted}
	}
	if err := validatePathBasics(root); err != nil {
		return selector, &BundleSelectorError{Name: name, Err: err}
	}

	if selector.include, err = glob.Compile(selector.Include, globSeparator); err != nil {
		return selector, &BundleSelectorError{
			Name: name,
			Err:  fmt.Errorf("%w: %s", ErrBundleSelectorPattern, selector.Include),
		}
	}
	for _, pattern := range selector.Exclude {
		compiled, err := glob.Compile(pattern, globSeparator)
		if err != nil {
			return selector, &BundleSelectorError{
				Name: name,
				Err:  fmt.Errorf("%w: %s", ErrBundleSelectorPattern, pattern),
			}
		}
		selector.exclude = append(selector.exclude, compiled)
	}

	return selector, nil
}

func isValidSelectorName(name string) bool {
	if name == "" || len(name) > bundleMaxSelectorName {
		return false
	}
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9', r == '-':
		default:
			return false
		}
	}
	return true
}

func optionalString(fields map[string]any, key string) (string, error) {
	raw, ok := fields[key]
	if !ok || raw == nil {
		return "", nil
	}
	value, ok := raw.(string)
	if !ok {
		return "", fmt.Errorf("%w: %s must be a string", ErrBundleFilesType, key)
	}
	return strings.TrimSpace(value), nil
}

func optionalStringSlice(fields map[string]any, key string) ([]string, error) {
	raw, ok := fields[key]
	if !ok || raw == nil {
		return nil, nil
	}
	entries, ok := raw.([]any)
	if !ok {
		return nil, fmt.Errorf("%w: %s must be a list of strings", ErrBundleFilesType, key)
	}
	out := make([]string, 0, len(entries))
	for _, entry := range entries {
		value, ok := entry.(string)
		if !ok {
			return nil, fmt.Errorf("%w: %s must be a list of strings", ErrBundleFilesType, key)
		}
		out = append(out, strings.TrimSpace(value))
	}
	return out, nil
}

// ResolvedBundlePart is what one named part matched at a given ref.
type ResolvedBundlePart struct {
	Name string
	// Matched paths, sorted. Empty is reported rather than hidden: a part that stops
	// matching (a renamed directory, say) must surface, not silently empty the bundle.
	Matched []string
}

// BundleResolution is a bundle's file set as resolved against one repository ref. It is
// what the owning resource reports in its status, and the ref it was resolved at is part
// of it: without that, a matched list is a claim with no referent, and neither staleness
// nor safe deletion can be determined.
type BundleResolution struct {
	// Ref is the repository ref (commit) the parts were matched against.
	Ref string
	// Parts in declaration (sorted-name) order.
	Parts []ResolvedBundlePart
	// Files is every matched path across all parts, de-duplicated and sorted.
	Files []string
	// Unresolved names the parts that matched nothing.
	Unresolved []string
}

// IsComplete reports whether every declared part matched at least one file.
func (r BundleResolution) IsComplete() bool { return len(r.Unresolved) == 0 }

// ResolveOptions carries what resolution needs beyond the selectors themselves.
type ResolveOptions struct {
	// Ref is the repository ref the candidate paths were listed at; recorded on the
	// resolution.
	Ref string
	// ManifestPath is the bundle's own file. It is never matched, and its directory is
	// what derives a part's default ownership.
	ManifestPath string
	// Reserved are paths no bundle may claim -- other bundles' manifests, chiefly, so a
	// wide pattern cannot swallow another resource and give the same bytes two
	// lifecycles.
	Reserved sets.Set[string]
}

// ResolveBundleFiles matches a bundle's parts against the repository paths listed at a
// ref.
//
// Candidates that are not valid repository paths are skipped rather than rejected: the
// listing describes a repository as it is, and a bundle cannot be held responsible for
// an unrelated file elsewhere in it. A path selected by more than one of this bundle's
// own parts is attributed to the first part by name, so the result is deterministic.
func ResolveBundleFiles(selectors []BundleSelector, candidates []string, opts ResolveOptions) (BundleResolution, error) {
	resolution := BundleResolution{Ref: opts.Ref}
	if len(selectors) == 0 {
		return resolution, nil
	}

	eligible := make([]string, 0, len(candidates))
	for _, path := range candidates {
		if path == opts.ManifestPath || opts.Reserved.Has(path) {
			continue
		}
		if safepath.IsDir(path) || validatePathBasics(path) != nil {
			continue
		}
		eligible = append(eligible, path)
	}
	sort.Strings(eligible)

	claimed := make(map[string]struct{}, len(eligible))
	for _, selector := range selectors {
		part := ResolvedBundlePart{Name: selector.Name}
		for _, path := range eligible {
			if _, taken := claimed[path]; taken {
				continue
			}
			if !selector.matches(path) {
				continue
			}
			claimed[path] = struct{}{}
			part.Matched = append(part.Matched, path)
			resolution.Files = append(resolution.Files, path)
		}

		if len(part.Matched) == 0 {
			resolution.Unresolved = append(resolution.Unresolved, selector.Name)
		}
		resolution.Parts = append(resolution.Parts, part)
	}

	if len(resolution.Files) > BundleMaxFiles {
		return BundleResolution{Ref: opts.Ref}, ErrBundleTooManyFiles
	}
	sort.Strings(resolution.Files)

	return resolution, nil
}

// BundleIndex counts, for a repository, which bundles claim which files.
//
// A file may be claimed by any number of bundles: a shared asset is stored once and
// referenced by each bundle that needs it. The index is therefore a reference count
// rather than an ownership map, and it answers the question cleanup depends on -- which
// stored files no bundle references any more.
//
// A BundleIndex is built per operation (a sync pass, a request) and is not safe for
// concurrent writes.
type BundleIndex struct {
	// claims maps a file path to the manifest paths of the bundles claiming it.
	claims map[string]sets.Set[string]
	// files maps a manifest path to the paths it claims, in resolution order.
	files map[string][]string
}

// NewBundleIndex returns an empty index.
func NewBundleIndex() *BundleIndex {
	return &BundleIndex{
		claims: make(map[string]sets.Set[string]),
		files:  make(map[string][]string),
	}
}

// Add records the files claimed by the bundle at manifestPath, replacing any claim it
// previously held. Claiming a path another bundle already claims is not an error -- that
// is how two bundles share an asset.
func (i *BundleIndex) Add(manifestPath string, files []string) {
	i.Remove(manifestPath)

	for _, path := range files {
		owners, ok := i.claims[path]
		if !ok {
			owners = sets.New[string]()
			i.claims[path] = owners
		}
		owners.Insert(manifestPath)
	}
	i.files[manifestPath] = files
}

// AddResolution records a resolved bundle's files.
func (i *BundleIndex) AddResolution(manifestPath string, resolution BundleResolution) {
	i.Add(manifestPath, resolution.Files)
}

// Remove drops a bundle and releases its share of every path it claimed.
func (i *BundleIndex) Remove(manifestPath string) {
	for _, path := range i.files[manifestPath] {
		owners, ok := i.claims[path]
		if !ok {
			continue
		}
		owners.Delete(manifestPath)
		if owners.Len() == 0 {
			delete(i.claims, path)
		}
	}
	delete(i.files, manifestPath)
}

// Owners returns the manifest paths of every bundle claiming path, sorted.
func (i *BundleIndex) Owners(path string) []string {
	return sets.List(i.claims[path])
}

// References returns how many bundles claim path.
func (i *BundleIndex) References(path string) int {
	return i.claims[path].Len()
}

// IsClaimed reports whether any bundle claims path.
func (i *BundleIndex) IsClaimed(path string) bool {
	return i.References(path) > 0
}

// Files returns the paths claimed by the bundle at manifestPath.
func (i *BundleIndex) Files(manifestPath string) []string {
	return i.files[manifestPath]
}

// Paths returns every claimed path across all bundles, sorted. This is the set a
// repository should hold stored files for; anything else is unreferenced.
func (i *BundleIndex) Paths() []string {
	out := make([]string, 0, len(i.claims))
	for path := range i.claims {
		out = append(out, path)
	}
	sort.Strings(out)
	return out
}

// Unreferenced returns the subset of paths that no bundle claims, sorted. Cleanup deletes
// exactly these: a stored file is kept while any bundle still references it.
func (i *BundleIndex) Unreferenced(paths []string) []string {
	out := make([]string, 0)
	for _, path := range paths {
		if !i.IsClaimed(path) {
			out = append(out, path)
		}
	}
	sort.Strings(out)
	return out
}

// Bundles returns the manifest paths of every indexed bundle, sorted.
func (i *BundleIndex) Bundles() []string {
	out := make([]string, 0, len(i.files))
	for manifestPath := range i.files {
		out = append(out, manifestPath)
	}
	sort.Strings(out)
	return out
}
