// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// +build ignore

package main

import (
	"bytes"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	dir, err := ioutil.TempDir("", "go-arrow-")
	if err != nil {
		log.Fatalf("could not create top-level temporary directory: %v", err)
	}
	defer os.RemoveAll(dir)

	genFormat(dir)
}

func genFormat(dir string) {
	args := []string{"--go", "-o", filepath.Join(dir, "format")}
	fnames, err := filepath.Glob("../../format/*.fbs")
	if err != nil || len(fnames) == 0 {
		log.Fatalf("could not retrieve list of format FlatBuffers files: files=%d err=%v",
			len(fnames), err,
		)
	}
	args = append(args, fnames...)

	gen := exec.Command("flatc", args...)
	gen.Stdout = os.Stdout
	gen.Stderr = os.Stderr

	err = gen.Run()
	if err != nil {
		log.Fatal(err)
	}

	err = os.MkdirAll("./internal/flatbuf", 0755)
	if err != nil {
		log.Fatalf("could not create ./internal/flatbuf directory: %v", err)
	}

	base := filepath.Join(dir, "format", "org", "apache", "arrow", "flatbuf")
	fnames, err = filepath.Glob(filepath.Join(base, "*.go"))
	if err != nil {
		log.Fatalf("could not glob %v/*.go: %v", base, err)
	}

	for _, fname := range fnames {
		dst := filepath.Join(".", "internal", "flatbuf", filepath.Base(fname))
		process(dst, fname)
	}
}

func process(dst, fname string) {
	raw, err := ioutil.ReadFile(fname)
	if err != nil {
		log.Fatal(err)
	}

	f, err := os.Create(dst)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	if !bytes.HasPrefix(raw, []byte(hdr)) {
		_, err = f.Write([]byte(hdr))
		if err != nil {
			log.Fatal(err)
		}
	}

	_, err = f.Write(raw)
	if err != nil {
		log.Fatal(err)
	}

	err = f.Close()
	if err != nil {
		log.Fatal(err)
	}
}

const hdr = `// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

`
