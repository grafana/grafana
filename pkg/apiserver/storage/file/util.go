// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package file

import (
	"bytes"
	"errors"
	"path/filepath"
	"strings"

	"github.com/hack-pad/hackpadfs"
	"k8s.io/apimachinery/pkg/runtime"
)

func filePath(key string) string {
	// Replace backslashes with underscores to avoid creating bogus subdirectories
	key = strings.Replace(key, "\\", "_", -1)
	fileName := filepath.Clean(key + ".json")
	return fileName
}

func dirPath(key string) string {
	// Replace backslashes with underscores to avoid creating bogus subdirectories
	key = strings.Replace(key, "\\", "_", -1)
	dirName := filepath.Clean(key)
	return dirName
}

func writeFile(fs hackpadfs.FS, codec runtime.Codec, path string, obj runtime.Object) error {
	buf := new(bytes.Buffer)
	if err := codec.Encode(obj, buf); err != nil {
		return err
	}
	return hackpadfs.WriteFullFile(fs, path, buf.Bytes(), 0600)
}

func readFile(fs hackpadfs.FS, codec runtime.Codec, path string, newFunc func() runtime.Object) (runtime.Object, error) {
	content, err := hackpadfs.ReadFile(fs, filepath.Clean(path))
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

func readDirRecursive(hfs hackpadfs.FS, codec runtime.Codec, path string, newFunc func() runtime.Object) ([]runtime.Object, error) {
	var objs []runtime.Object
	err := hackpadfs.WalkDir(hfs, path, func(path string, info hackpadfs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() || filepath.Ext(path) != ".json" {
			return nil
		}
		obj, err := readFile(hfs, codec, path, newFunc)
		if err != nil {
			return err
		}
		objs = append(objs, obj)
		return nil
	})
	if err != nil {
		if errors.Is(err, hackpadfs.ErrNotExist) {
			return objs, nil
		}
		return nil, err
	}
	return objs, nil
}

func exists(fs hackpadfs.FS, filepath string) bool {
	_, err := hackpadfs.Stat(fs, filepath)
	return err == nil
}

func ensureDir(fs hackpadfs.FS, dirname string) error {
	if !exists(fs, dirname) {
		return hackpadfs.MkdirAll(fs, dirname, 0700)
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
