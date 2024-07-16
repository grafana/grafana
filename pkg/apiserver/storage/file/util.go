// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package file

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync/atomic"

	"k8s.io/apimachinery/pkg/runtime"
)

// Copied from https://github.com/grafana/grafana/blob/main/pkg/storage/unified/resource/validation.go#L11
var validNameCharPattern = `a-zA-Z0-9\-\_`
var validNamePattern = regexp.MustCompile(`^[` + validNameCharPattern + `]*$`).MatchString

func (s *Storage) filePath(key string) (string, error) {
	for _, part := range strings.Split(key, "/") {
		if len(part) > 64 {
			return "", fmt.Errorf("invalid key (too log)")
		}
		if !validNamePattern(part) {
			return "", fmt.Errorf("name includes invalid characters")
		}
	}

	fileName := filepath.Join(s.root, filepath.Clean(key+".json"))
	return fileName, nil
}

func writeFile(codec runtime.Codec, path string, obj runtime.Object) error {
	buf := new(bytes.Buffer)
	if err := codec.Encode(obj, buf); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0600)
}

var fileReadCount uint64 = 0

//func getReadsAndReset() uint64 {
//return atomic.SwapUint64(&fileReadCount, 0)
//}

func readFile(codec runtime.Codec, path string, newFunc func() runtime.Object) (runtime.Object, error) {
	atomic.AddUint64(&fileReadCount, 1)
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
