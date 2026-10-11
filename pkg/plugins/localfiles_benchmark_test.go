package plugins

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

const (
	benchmarkPluginFiles     = 249
	benchmarkDependencyFiles = 702
)

var benchmarkDependencyPackages = []struct {
	name  string
	files int
}{
	{name: "@grafana/scenes", files: 485},
	{name: "uuid", files: 190},
	{name: "history", files: 27},
}

func BenchmarkLocalFSFilesNodeModules(b *testing.B) {
	pluginDir := b.TempDir()
	createLocalFSBenchmarkFixture(b, pluginDir)

	localFS := NewLocalFS(pluginDir)

	b.Run("skips_node_modules", func(b *testing.B) {
		benchmarkLocalFSFiles(b, localFS, benchmarkPluginFiles)
	})
	b.Run("walks_node_modules", func(b *testing.B) {
		benchmarkFilesIncludingNodeModules(b, localFS, benchmarkPluginFiles+benchmarkDependencyFiles)
	})
}

func benchmarkLocalFSFiles(b *testing.B, localFS LocalFS, expectedFiles int) {
	b.Helper()
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		files, err := localFS.Files()
		if err != nil {
			b.Fatal(err)
		}
		if len(files) != expectedFiles {
			b.Fatalf("got %d files, want %d", len(files), expectedFiles)
		}
	}
}

func benchmarkFilesIncludingNodeModules(b *testing.B, localFS LocalFS, expectedFiles int) {
	b.Helper()
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		files, err := filesIncludingNodeModules(localFS)
		if err != nil {
			b.Fatal(err)
		}
		if len(files) != expectedFiles {
			b.Fatalf("got %d files, want %d", len(files), expectedFiles)
		}
	}
}

func createLocalFSBenchmarkFixture(b *testing.B, pluginDir string) {
	b.Helper()
	for i := range benchmarkPluginFiles {
		writeLocalFSBenchmarkFile(b, filepath.Join(pluginDir, "dist", fmt.Sprintf("asset-%04d.js", i)))
	}

	for _, dependencyPackage := range benchmarkDependencyPackages {
		for file := range dependencyPackage.files {
			writeLocalFSBenchmarkFile(b, filepath.Join(pluginDir, "node_modules", dependencyPackage.name, "dist", fmt.Sprintf("file-%04d.js", file)))
		}
	}
}

func writeLocalFSBenchmarkFile(b *testing.B, path string) {
	b.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		b.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("benchmark"), 0o600); err != nil {
		b.Fatal(err)
	}
}

func filesIncludingNodeModules(localFS LocalFS) ([]string, error) {
	absFilePaths := make(map[string]struct{})
	if err := filepath.Walk(localFS.Base(), func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		ok, err := localFS.fileIsAllowed(localFS.Base(), path, info)
		if err != nil {
			return err
		}
		if !ok {
			return nil
		}
		absFilePaths[path] = struct{}{}
		return nil
	}); err != nil {
		return nil, err
	}

	relFiles := make([]string, 0, len(absFilePaths))
	for path := range absFilePaths {
		relPath, err := filepath.Rel(localFS.Base(), path)
		if err != nil {
			return nil, err
		}
		cleanPath, err := CleanRelativePath(relPath)
		if err != nil {
			continue
		}
		relFiles = append(relFiles, cleanPath)
	}
	return relFiles, nil
}
