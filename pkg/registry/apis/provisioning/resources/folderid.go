package resources

import (
	"crypto/sha256"
	"encoding/hex"
	"path"
	"regexp"
	"strings"
)

var disallowedKubernetesCharacters = regexp.MustCompile(`[^-a-z0-9]`)

// FolderID contains the identifier data for a folder.
type FolderID struct {
	// Title is the human-readable name created by a human who wrote it.
	Title string
	// KubernetesName represents the name the folder should have, derived from the title.
	// It contains a suffix calculated from the path of the folder.
	KubernetesName string
	// Path is the full path to the folder, as given to the parse function.
	Path string
}

func ParseFolderID(dirPath string) FolderID {
	clean := strings.Trim(path.Clean(dirPath), "/")
	return FolderID{
		Title:          calculateFolderTitleFromPath(clean),
		KubernetesName: calculateKubernetesNameFromPath(clean),
		Path:           dirPath,
	}
}

func calculateFolderTitleFromPath(cleanDirPath string) string {
	titleIdx := strings.LastIndex(cleanDirPath, "/")
	title := cleanDirPath
	if titleIdx != -1 {
		title = title[titleIdx+1:]
	}
	return title
}

func calculateKubernetesNameFromPath(cleanDirPath string) string {
	cleanHash := sha256.Sum256([]byte(cleanDirPath))

	kubernetesName := strings.ToLower(cleanDirPath)
	kubernetesName = stringAfterLastSep(kubernetesName, "/")
	kubernetesName = strings.ReplaceAll(kubernetesName, "_", "-")
	kubernetesName = strings.ReplaceAll(kubernetesName, " ", "-")
	kubernetesName = disallowedKubernetesCharacters.ReplaceAllString(kubernetesName, "")
	kubernetesName = strings.Trim(kubernetesName, "-") // cannot start or end with hyphen
	// Should be a relatively normalised name by now, if anything even remains.

	// We want a suffix that is the full path's SHA-256 hash, but only a part of it.
	// The part must be at least a few characters (here, 8) to ensure we avoid collisions.
	// It doesn't need to be super long in order to avoid collisions, so we can just keep it to a single length.
	const suffixLen = 8
	kubeSuffix := hex.EncodeToString(cleanHash[:])[:suffixLen]
	const maxKubeNameLen = 253
	const cutNameAt = maxKubeNameLen - 1 /* hyphen */ - suffixLen

	// TODO: Should we maybe use the last N characters than the first N? That'd make it align more with what the user expects from the UI...
	if len(kubernetesName) > cutNameAt {
		kubernetesName = kubernetesName[:cutNameAt]
	}
	kubernetesName = kubernetesName + "-" + kubeSuffix

	return kubernetesName
}

func stringAfterLastSep(s, sep string) string {
	idx := strings.LastIndex(s, sep)
	if idx == -1 {
		return s
	}
	return s[idx+1:]
}
