/*
Copyright 2014 The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// a part of cert util from https://github.com/kubernetes/client-go/tree/master/util/cert copied here
// without modifications. This is to remove dependencies on client-go for this largely independent
// piece around cert generation.

package certgenerator

import (
	"fmt"
	"os"
	"path/filepath"
)

// canReadCertAndKey returns true if the certificate and key files already exists,
// otherwise returns false. If lost one of cert and key, returns error.
func canReadCertAndKey(certPath, keyPath string) (bool, error) {
	certReadable := canReadFile(certPath)
	keyReadable := canReadFile(keyPath)

	if certReadable == false && keyReadable == false {
		return false, nil
	}

	if certReadable == false {
		return false, fmt.Errorf("error reading %s, certificate and key must be supplied as a pair", certPath)
	}

	if keyReadable == false {
		return false, fmt.Errorf("error reading %s, certificate and key must be supplied as a pair", keyPath)
	}

	return true, nil
}

// If the file represented by path exists and
// readable, returns true otherwise returns false.
func canReadFile(path string) bool {
	f, err := os.Open(path)
	if err != nil {
		return false
	}

	defer f.Close()

	return true
}

func writeToFile(filePath string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(filePath), os.FileMode(0755)); err != nil {
		return err
	}
	return os.WriteFile(filePath, data, os.FileMode(0600))
}
