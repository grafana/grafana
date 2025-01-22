package jobs

import "path"

type folderTree struct {
	tree       map[string]string
	repoFolder string
}

func (t *folderTree) In(folder string) bool {
	_, ok := t.tree[folder]
	return ok
}

// DirPath creates the path to the directory with slashes.
// The repository folder is not included in the path.
// If In(folder) is false, this will panic, because it would be undefined behaviour.
func (t *folderTree) DirPath(folder string) string {
	if folder == t.repoFolder {
		return ""
	}
	if !t.In(folder) {
		panic("undefined behaviour")
	}

	dirPath := folder
	parent := t.tree[folder]
	for parent != "" && parent != t.repoFolder {
		dirPath = path.Join(parent, dirPath)
		parent = t.tree[parent]
	}
	// Not using Clean here is intentional. We don't want `.` or similar.
	return dirPath
}
