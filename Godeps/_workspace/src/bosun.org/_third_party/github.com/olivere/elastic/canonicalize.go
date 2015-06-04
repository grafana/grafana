// Copyright 2012-2015 Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "net/url"

// canonicalize takes a list of URLs and returns its canonicalized form, i.e.
// remove anything but scheme, userinfo, host, and port. It also removes the
// slash at the end. It also skips invalid URLs or URLs that do not use
// protocol http or https.
//
// Example:
// http://127.0.0.1:9200/path?query=1 -> http://127.0.0.1:9200
func canonicalize(rawurls ...string) []string {
	canonicalized := make([]string, 0)
	for _, rawurl := range rawurls {
		u, err := url.Parse(rawurl)
		if err == nil && (u.Scheme == "http" || u.Scheme == "https") {
			u.Fragment = ""
			u.Path = ""
			u.RawQuery = ""
			canonicalized = append(canonicalized, u.String())
		}
	}
	return canonicalized
}
