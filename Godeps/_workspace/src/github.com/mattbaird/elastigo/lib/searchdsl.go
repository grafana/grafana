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

type SearchRequest struct {
	From  int          `json:"from,omitempty"`
	Size  int          `json:"size,omitempty"`
	Query OneTermQuery `json:"query,omitempty"`

	Filter struct {
		Term Term `json:"term"`
	} `json:"filter,omitempty"`
}

type Facets struct {
	Tag struct {
		Terms string `json:"terms"`
	} `json:"tag"`
}
