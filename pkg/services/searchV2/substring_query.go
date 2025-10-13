// based on https://github.com/blugelabs/bluge/blob/57414197005148539c5dc5db8ab581594969df79/query.go#L1407-L1482, license:
// Copyright (c) 2020 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package searchV2

import (
	"strings"

	"github.com/blugelabs/bluge/search"
	"github.com/blugelabs/bluge/search/searcher"
	"github.com/blugelabs/bluge/search/similarity"
)

type boost float64

func (b *boost) Value() float64 {
	if b == nil {
		return 1
	}
	return float64(*b)
}

type SubstringQuery struct {
	substring string
	field     string
	boost     *boost
	scorer    search.Scorer
}

func NewSubstringQuery(wildcard string) *SubstringQuery {
	return &SubstringQuery{
		substring: wildcard,
	}
}

// Wildcard returns the substring being queried
func (q *SubstringQuery) Wildcard() string {
	return q.substring
}

func (q *SubstringQuery) SetBoost(b float64) *SubstringQuery {
	boostVal := boost(b)
	q.boost = &boostVal
	return q
}

func (q *SubstringQuery) Boost() float64 {
	return q.boost.Value()
}

func (q *SubstringQuery) SetField(f string) *SubstringQuery {
	q.field = f
	return q
}

func (q *SubstringQuery) Field() string {
	return q.field
}

var regexpEscaper = strings.NewReplacer(
	// characters in the substring that must
	// be escaped in the regexp
	"+", `\+`,
	"*", `\*`,
	"(", `\(`,
	")", `\)`,
	"^", `\^`,
	"$", `\$`,
	".", `\.`,
	"{", `\{`,
	"}", `\}`,
	"[", `\[`,
	"]", `\]`,
	`|`, `\|`,
	`\`, `\\`)

func (q *SubstringQuery) Searcher(i search.Reader, options search.SearcherOptions) (search.Searcher, error) {
	field := q.field
	if q.field == "" {
		field = options.DefaultSearchField
	}

	regexpString := ".*" + regexpEscaper.Replace(q.substring) + ".*"
	return searcher.NewRegexpStringSearcher(i, regexpString, field,
		q.boost.Value(), q.scorer, similarity.NewCompositeSumScorer(), options)
}

func (q *SubstringQuery) Validate() error {
	return nil // real validation delayed until searcher constructor
}
