// Copyright 2020 The Macaron Authors
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

// Package cookie contains helper functions for setting cookie values.
package cookie

import (
	"net/http"
	"time"
)

// MaxAge sets the maximum age for a provided cookie
func MaxAge(maxAge int) func(*http.Cookie) {
	return func(c *http.Cookie) {
		c.MaxAge = maxAge
	}
}

// Path sets the path for a provided cookie
func Path(path string) func(*http.Cookie) {
	return func(c *http.Cookie) {
		c.Path = path
	}
}

// Domain sets the domain for a provided cookie
func Domain(domain string) func(*http.Cookie) {
	return func(c *http.Cookie) {
		c.Domain = domain
	}
}

// Secure sets the secure setting for a provided cookie
func Secure(secure bool) func(*http.Cookie) {
	return func(c *http.Cookie) {
		c.Secure = secure
	}
}

// HttpOnly sets the HttpOnly setting for a provided cookie
func HttpOnly(httpOnly bool) func(*http.Cookie) {
	return func(c *http.Cookie) {
		c.HttpOnly = httpOnly
	}
}

// HTTPOnly sets the HttpOnly setting for a provided cookie
func HTTPOnly(httpOnly bool) func(*http.Cookie) {
	return func(c *http.Cookie) {
		c.HttpOnly = httpOnly
	}
}

// Expires sets the expires and rawexpires for a provided cookie
func Expires(expires time.Time) func(*http.Cookie) {
	return func(c *http.Cookie) {
		c.Expires = expires
		c.RawExpires = expires.Format(time.UnixDate)
	}
}

// SameSite sets the SameSite for a provided cookie
func SameSite(sameSite http.SameSite) func(*http.Cookie) {
	return func(c *http.Cookie) {
		c.SameSite = sameSite
	}
}
