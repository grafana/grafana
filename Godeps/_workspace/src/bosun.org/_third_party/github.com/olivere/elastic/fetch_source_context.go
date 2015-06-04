// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import (
	"net/url"
	"strings"
)

type FetchSourceContext struct {
	fetchSource     bool
	transformSource bool
	includes        []string
	excludes        []string
}

func NewFetchSourceContext(fetchSource bool) *FetchSourceContext {
	return &FetchSourceContext{
		fetchSource: fetchSource,
		includes:    make([]string, 0),
		excludes:    make([]string, 0),
	}
}

func (fsc *FetchSourceContext) FetchSource() bool {
	return fsc.fetchSource
}

func (fsc *FetchSourceContext) SetFetchSource(fetchSource bool) {
	fsc.fetchSource = fetchSource
}

func (fsc *FetchSourceContext) Include(includes ...string) *FetchSourceContext {
	fsc.includes = append(fsc.includes, includes...)
	return fsc
}

func (fsc *FetchSourceContext) Exclude(excludes ...string) *FetchSourceContext {
	fsc.excludes = append(fsc.excludes, excludes...)
	return fsc
}

func (fsc *FetchSourceContext) TransformSource(transformSource bool) *FetchSourceContext {
	fsc.transformSource = transformSource
	return fsc
}

func (fsc *FetchSourceContext) Source() interface{} {
	if !fsc.fetchSource {
		return false
	}
	return map[string]interface{}{
		"includes": fsc.includes,
		"excludes": fsc.excludes,
	}
}

// Query returns the parameters in a form suitable for a URL query string.
func (fsc *FetchSourceContext) Query() url.Values {
	params := url.Values{}
	if !fsc.fetchSource {
		params.Add("_source", "false")
		return params
	}
	if len(fsc.includes) > 0 {
		params.Add("_source_include", strings.Join(fsc.includes, ","))
	}
	if len(fsc.excludes) > 0 {
		params.Add("_source_exclude", strings.Join(fsc.excludes, ","))
	}
	return params
}
