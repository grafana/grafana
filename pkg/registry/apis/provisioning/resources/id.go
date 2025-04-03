package resources

import (
	"crypto/sha256"
	"encoding/base64"
	"strings"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

// sanitiseKubeName removes all characters that don't fulfil the DNS subdomain name rules: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#dns-subdomain-names
// > contain no more than 253 characters
// > contain only lowercase alphanumeric characters, '-' or '.'
// > start with an alphanumeric character
// > end with an alphanumeric character
//
// That said, the Kubernetes name is extended with one more rule: it must not contain more than 40 characters.
// We do this to support storage modes that write to legacy storage, where UIDs are limited to 40 characters or less.
//
// If no characters are valid, this returns an empty string.
func sanitiseKubeName(s string) string {
	// Note: Builder never returns an error.
	var b strings.Builder
	lastHyphen := false // Having at most 1 hyphen in a row is not a requirement, but is closer to standard convention.
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '.' || r == '-' {
			// We don't want to have multiple hyphens following one another.
			if !lastHyphen || r != '-' {
				lastHyphen = r == '-'
				_, _ = b.WriteRune(r)
			}
		} else if r >= 'A' && r <= 'Z' {
			lastHyphen = false
			r += 'a' - 'A'
			_, _ = b.WriteRune(r)
		} else if (r == '_' || r == '/') && !lastHyphen { // Special-case for common characters that we still want to keep somehow
			lastHyphen = true
			_, _ = b.WriteRune('-')
		}
		// Else, skip it, silently.

		if b.Len() == 40 {
			// Technically, we could be less than 40 after some more cleaning... but this is good enough.
			break
		}
	}
	str := b.String()
	// We must start and end with alphanumerics.
	str = strings.Trim(str, "-")
	str = strings.Trim(str, ".")

	return str
}

// appendHashSuffix creates a function that modifies an input string to include a hash suffix.
// The goal of this function is to represent all needs for hashing IDs.
//
// The hash uses the input hashKey and repositoryName as a salt.
// The output string is at most 40 characters long. (253 is Kubernetes' limit, but UIDs have a max of 40 characters.)
// The output string is a valid Kubernetes name (see [sanitiseKubeName]).
// The output string contains at least 12 characters of a hash, plus a 1 character hyphen to separate the input and the hash.
// The function is deterministic given the same invocation parameters to this function.
func appendHashSuffix(hashKey, repositoryName string) func(string) string {
	salt := []byte(repositoryName + "/" + hashKey)

	const maxLen = 40              // valid Kubernetes name
	const minSuffix = 8            // excluding hyphen
	const minSpace = minSuffix + 1 // +1 for hyphen

	return func(s string) string {
		hasher := sha256.New()
		// From hash.Hash docs:
		// > Write (via the embedded io.Writer interface) adds more data to the running hash.
		// > It never returns an error.
		// As such, we ignore all errors.
		_, _ = hasher.Write(salt) // Input to the parent function
		_, _ = hasher.Write([]byte(s))
		hash := base64.URLEncoding.EncodeToString(hasher.Sum(nil))
		hash = sanitiseKubeName(hash) // We have rules to follow, as per our doc contract

		if len(s) > maxLen-minSpace {
			s = s[:maxLen-minSpace]
		}

		spaceForHash := maxLen - len(s) - 1
		if spaceForHash < len(hash) {
			hash = hash[:spaceForHash]
		}
		return sanitiseKubeName(s + "-" + hash)
	}
}

// Will pick a name based on the hashed repository and path
func FileNameFromHashedRepoPath(repo string, fpath string) string {
	// Remove the extension: we don't want the extension to impact the ID. This lets the user change between all supported formats.
	fpath = safepath.RemoveExt(fpath)
	hasher := appendHashSuffix(fpath, repo)

	return hasher(safepath.Base(fpath))
}

// Folder contains the data for a folder we use in provisioning.
type Folder struct {
	// Title is the human-readable name created by a human who wrote it.
	Title string
	// ID represents the name the folder should have, derived from the title.
	// It contains a suffix calculated from the path of the folder.
	// The ID is used in Kubernetes and the folders API server. This is the same as the legacy (and by the time you read this, hopefully removed) UID concept of folders.
	ID string
	// Path is the full path to the folder, as given to the parse function.
	Path string
}

func ParseFolder(dirPath, repositoryName string) Folder {
	hasher := appendHashSuffix(strings.TrimSuffix(dirPath, "/"), repositoryName)
	base := safepath.Base(dirPath)

	return Folder{
		Title: base,
		ID:    hasher(sanitiseKubeName(base)),
		Path:  dirPath,
	}
}

func RootFolder(repository *provisioning.Repository) string {
	if repository.Spec.Sync.Target == provisioning.SyncTargetTypeFolder {
		return repository.Name // a folder with the same identifier as the repository
	}

	return ""
}

func ParentFolder(filePath string, repository *provisioning.Repository) string {
	parent := safepath.Dir(filePath)
	if parent == "" {
		return RootFolder(repository)
	}

	return ParseFolder(parent, repository.GetName()).ID
}
