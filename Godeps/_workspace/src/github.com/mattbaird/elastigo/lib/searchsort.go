// Copyright 2013 Matthew Baird
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//     http://www.apache.org/licenses/LICENSE-2.0
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package elastigo

import (
	"encoding/json"
	"fmt"
)

// SortDsl accepts any number of Sort commands
//
//     Query().Sort(
//         Sort("last_name").Desc(),
//         Sort("age"),
//     )
func Sort(field string) *SortDsl {
	return &SortDsl{Name: field}
}

type SortBody []interface{}
type SortDsl struct {
	Name   string
	IsDesc bool
}

func (s *SortDsl) Desc() *SortDsl {
	s.IsDesc = true
	return s
}
func (s *SortDsl) Asc() *SortDsl {
	s.IsDesc = false
	return s
}

func (s *SortDsl) MarshalJSON() ([]byte, error) {
	if s.IsDesc {
		return json.Marshal(map[string]string{s.Name: "desc"})
	}
	if s.Name == "_score" {
		return []byte(`"_score"`), nil
	}
	return []byte(fmt.Sprintf(`"%s"`, s.Name)), nil // "user"  assuming default = asc?
}
