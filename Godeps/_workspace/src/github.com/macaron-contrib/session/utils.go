// Copyright 2013 Beego Authors
// Copyright 2014 Unknwon
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.

package session

import (
	"bytes"
	"crypto/rand"
	"encoding/gob"
	"io"

	"github.com/Unknwon/com"
)

func EncodeGob(obj map[interface{}]interface{}) ([]byte, error) {
	for _, v := range obj {
		gob.Register(v)
	}
	buf := bytes.NewBuffer(nil)
	err := gob.NewEncoder(buf).Encode(obj)
	return buf.Bytes(), err
}

func DecodeGob(encoded []byte) (out map[interface{}]interface{}, err error) {
	buf := bytes.NewBuffer(encoded)
	err = gob.NewDecoder(buf).Decode(&out)
	return out, err
}

// generateRandomKey creates a random key with the given strength.
func generateRandomKey(strength int) []byte {
	k := make([]byte, strength)
	if n, err := io.ReadFull(rand.Reader, k); n != strength || err != nil {
		return com.RandomCreateBytes(strength)
	}
	return k
}
