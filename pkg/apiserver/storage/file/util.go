// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package file

import (
	"bytes"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
)

func (s *Storage) filePath(key string) string {
	// Replace backslashes with underscores to avoid creating bogus subdirectories
	key = strings.Replace(key, "\\", "_", -1)
	fileName := filepath.Join(s.root, filepath.Clean(key+".json"))
	return fileName
}

// this is for constructing dirPath in a sanitized way provided you have
// already calculated the key. In order to go in the other direction, from a file path
// key to its dir, use the go standard library: filepath.Dir
func (s *Storage) dirPath(key string) string {
	return dirPath(s.root, key)
}

func writeFile(codec runtime.Codec, path string, obj runtime.Object) error {
	buf := new(bytes.Buffer)
	if err := codec.Encode(obj, buf); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0600)
}

func readFile(codec runtime.Codec, path string, newFunc func() runtime.Object) (runtime.Object, error) {
	content, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return nil, err
	}
	newObj := newFunc()
	decodedObj, _, err := codec.Decode(content, nil, newObj)
	if err != nil {
		return nil, err
	}
	return decodedObj, nil
}

func readDirRecursive(codec runtime.Codec, path string, newFunc func() runtime.Object) ([]runtime.Object, error) {
	var objs []runtime.Object
	err := filepath.Walk(path, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || filepath.Ext(path) != ".json" {
			return nil
		}
		obj, err := readFile(codec, path, newFunc)
		if err != nil {
			return err
		}
		objs = append(objs, obj)
		return nil
	})
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return objs, nil
		}
		return nil, err
	}
	return objs, nil
}

func deleteFile(path string) error {
	return os.Remove(path)
}

func exists(filepath string) bool {
	_, err := os.Stat(filepath)
	return err == nil
}

func dirPath(root string, key string) string {
	// Replace backslashes with underscores to avoid creating bogus subdirectories
	key = strings.Replace(key, "\\", "_", -1)
	dirName := filepath.Join(root, filepath.Clean(key))
	return dirName
}

func ensureDir(dirname string) error {
	if !exists(dirname) {
		return os.MkdirAll(dirname, 0700)
	}
	return nil
}

func isUnchanged(codec runtime.Codec, obj runtime.Object, newObj runtime.Object) (bool, error) {
	buf := new(bytes.Buffer)
	if err := codec.Encode(obj, buf); err != nil {
		return false, err
	}

	newBuf := new(bytes.Buffer)
	if err := codec.Encode(newObj, newBuf); err != nil {
		return false, err
	}

	return bytes.Equal(buf.Bytes(), newBuf.Bytes()), nil
}
