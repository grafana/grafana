package filestorage

import (
	"testing"
)

func TestFilestorage_Filter(t *testing.T) {
	//var tests = []struct {
	//	name     string
	//	parts    []string
	//	expected string
	//}{
	//	{
	//		name:     "multiple parts",
	//		parts:    []string{"prefix", "p1", "p2"},
	//		expected: "/prefix/p1/p2",
	//	},
	//	{
	//		name:     "no parts",
	//		parts:    []string{},
	//		expected: "/",
	//	},
	//	{
	//		name:     "a single part",
	//		parts:    []string{"prefix"},
	//		expected: "/prefix",
	//	},
	//}
	//for _, tt := range tests {
	//	t.Run(tt.name, func(t *testing.T) {
	//		require.Equal(t, tt.expected, Join(tt.parts...))
	//	})
	//}

	//t.Run("abc", func(t *testing.T) {
	//	require.Equal(t, "/*", NewAllowAllPathFilter().ToString())
	//	require.Equal(t, "!/*", NewDenyAllPathFilter().ToString())
	//})
	//
	//t.Run("add case 1", func(t *testing.T) {
	//	pathFilterA := NewPathFilter(
	//		[]string{"/folder1/folder2/", "/folder1/folder20/"},
	//		[]string{"/folder4/folder5/file.a"},
	//		[]string{"/folder3/"},
	//		[]string{"/folder1/folder2/abc.jpg"},
	//	)
	//
	//	pathFilterB := NewPathFilter(
	//		[]string{"/folder1/", "/folder10/"},
	//		[]string{"/folder5/folder5/file.a", "/folder4/folder5/file.a", "/folder1/folder2/folder3/ohAFile.jpg"},
	//		[]string{"/folder3/"},
	//		[]string{"/folder1/folder2/abc.jpg"},
	//	)
	//
	//	add := pathFilterA.intersection(pathFilterB)
	//	require.Equal(t, "", add.ToString())
	//})
	//
	//t.Run("add case allow all", func(t *testing.T) {
	//	pathFilterA := NewPathFilter(
	//		[]string{"/folder1/folder2/", "/folder1/folder20/"},
	//		[]string{"/folder4/folder5/file.a"},
	//		[]string{"/folder3/"},
	//		[]string{"/folder1/folder2/abc.jpg"},
	//	)
	//
	//	pathFilterB := NewAllowAllPathFilter()
	//	add := pathFilterA.intersection(pathFilterB)
	//	require.Equal(t, "", add.ToString())
	//})
	//
	//t.Run("add case deny all", func(t *testing.T) {
	//	pathFilterA := NewPathFilter(
	//		[]string{"/folder1/folder2/", "/folder1/folder20/"},
	//		[]string{"/folder4/folder5/file.a"},
	//		[]string{"/folder3/"},
	//		[]string{"/folder1/folder2/abc.jpg"},
	//	)
	//
	//	pathFilterB := NewDenyAllPathFilter()
	//	add := pathFilterA.intersection(pathFilterB)
	//	require.Equal(t, "", add.ToString())
	//})
}
