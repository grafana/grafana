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
	"fmt"
	//"github.com/araddon/gou"
	"github.com/bmizerany/assert"
	"testing"
)

func TestFilters(t *testing.T) {
	c := NewTestConn()

	// search for docs that are missing repository.name
	qry := Search("github").Filter(
		Filter().Exists("repository.name"),
	)
	out, err := qry.Result(c)
	assert.T(t, err == nil, t, "should not have error")
	expectedDocs := 10
	expectedHits := 7695
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs got %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v total got %v", expectedHits, out.Hits.Total))
	qry = Search("github").Filter(
		Filter().Missing("repository.name"),
	)
	expectedHits = 390
	out, _ = qry.Result(c)
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs got %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v total got %v", expectedHits, out.Hits.Total))

	//actor_attributes: {type: "User",
	qry = Search("github").Filter(
		Filter().Terms("actor_attributes.location", "portland"),
	)
	out, _ = qry.Result(c)
	expectedDocs = 10
	expectedHits = 71
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs got %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v total got %v", expectedHits, out.Hits.Total))

	/*
		Should this be an AND by default?
	*/
	qry = Search("github").Filter(
		Filter().Terms("actor_attributes.location", "portland"),
		Filter().Terms("repository.has_wiki", true),
	)
	out, err = qry.Result(c)
	expectedDocs = 10
	expectedHits = 44
	assert.T(t, err == nil, t, "should not have error")
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs got %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v total got %v", expectedHits, out.Hits.Total))

	// NOW, lets try with two query calls instead of one
	qry = Search("github").Filter(
		Filter().Terms("actor_attributes.location", "portland"),
	)
	qry.Filter(
		Filter().Terms("repository.has_wiki", true),
	)
	out, err = qry.Result(c)
	//gou.Debug(out)
	assert.T(t, err == nil, t, "should not have error")
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs got %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v total got %v", expectedHits, out.Hits.Total))

	qry = Search("github").Filter(
		"or",
		Filter().Terms("actor_attributes.location", "portland"),
		Filter().Terms("repository.has_wiki", true),
	)
	out, err = qry.Result(c)
	expectedHits = 6676
	assert.T(t, err == nil, t, "should not have error")
	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs got %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have %v total got %v", expectedHits, out.Hits.Total))
}

func TestFilterRange(t *testing.T) {
	c := NewTestConn()

	// now lets filter range for repositories with more than 100 forks
	out, _ := Search("github").Size("25").Filter(
		Range().Field("repository.forks").From("100"),
	).Result(c)
	if out == nil || &out.Hits == nil {
		t.Fail()
		return
	}
	expectedDocs := 25
	expectedHits := 725

	assert.T(t, out.Hits.Len() == expectedDocs, fmt.Sprintf("Should have %v docs got %v", expectedDocs, out.Hits.Len()))
	assert.T(t, out.Hits.Total == expectedHits, fmt.Sprintf("Should have total %v got %v", expectedHits, out.Hits.Total))
}
