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

// MoreLikeThis allows the caller to get documents that are “like” a specified document.
// http://www.elasticsearch.org/guide/reference/api/more-like-this.html
func (c *Conn) MoreLikeThis(index string, _type string, id string, args map[string]interface{}, query MoreLikeThisQuery) (BaseResponse, error) {
	var url string
	var retval BaseResponse
	url = fmt.Sprintf("/%s/%s/%s/_mlt", index, _type, id)
	body, err := c.DoCommand("GET", url, args, query)
	if err != nil {
		return retval, err
	}
	if err == nil {
		// marshall into json
		jsonErr := json.Unmarshal(body, &retval)
		if jsonErr != nil {
			return retval, jsonErr
		}
	}
	return retval, err
}

type MoreLikeThisQuery struct {
	MoreLikeThis MLT `json:"more_like_this"`
}

type MLT struct {
	Fields              []string `json:"fields"`
	LikeText            string   `json:"like_text"`
	PercentTermsToMatch float32  `json:"percent_terms_to_match"`
	MinTermFrequency    int      `json:"min_term_freq"`
	MaxQueryTerms       int      `json:"max_query_terms"`
	StopWords           []string `json:"stop_words"`
	MinDocFrequency     int      `json:"min_doc_freq"`
	MaxDocFrequency     int      `json:"max_doc_freq"`
	MinWordLength       int      `json:"min_word_len"`
	MaxWordLength       int      `json:"max_word_len"`
	BoostTerms          int      `json:"boost_terms"`
	Boost               float32  `json:"boost"`
	Analyzer            string   `json:"analyzer"`
}
