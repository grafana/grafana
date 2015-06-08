/*
 * Copyright (c) 2013 Matt Jibson <matt.jibson@gmail.com>
 *
 * Permission to use, copy, modify, and distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

/*
Package miniprofiler is a simple but effective mini-profiler for websites.

To use this package, change your HTTP handler functions to use this signature:

	func(miniprofiler.Timer, http.ResponseWriter, *http.Request)

Register them in the usual way, wrapping them with NewHandler.

By default, all requests are profiled. This should be changed to profile
only developer requests. Set miniprofiler.Enable to a function that returns
true if profiling is enabled. It might resemble this:

	miniprofiler.Enable = func(r *http.Request) bool {
		return isUserAuthenticated(r)
	}

By default, profile results are stored in memory in a concurrent-safe
data structure. To store in redis, memcache, or something else, set
miniprofiler.Store and miniprofiler.Get to functions to back the profile
data. The key is Profile.Id.

Send output of t.Includes() to your HTML (it is empty if Enable returns
false).

Step

The Step function can be used to profile more specific parts of your code. It
should be called with the name of the step and a closure. Further Timers are
used so concurrent work can be done and results applied to the correct location.

	t.Step("something", func(t miniprofiler.Timer) {
		// do some work
		// t.Step("another", func(t miniprofiler.Timer) { ... })
	})

StepCustomTiming

StepCustomTiming can be used to record any kind of call (redis, RPC, etc.)

	t.StepCustomTiming(
		"redis",       // call type
		"get",         // execute type
		"get key_name" // command string
		func() {
			// do work
		}
	)

Example

This is a small example using this package.

	package main

	import (
		"fmt"
		"net/http"

		"github.com/MiniProfiler/go/miniprofiler"
	)

	func Index(t miniprofiler.Timer, w http.ResponseWriter, r *http.Request) {
		t.Step("something", func(t miniprofiler.Timer) {
			t.StepCustomTiming("RPC", "get", "get key_name", func() {
				// some RPC call
			})
		})
		fmt.Fprintf(w, "<html><body>%v</body></html>", p.Includes())
	}

	func main() {
		http.Handle("/", miniprofiler.NewHandler(Index))
		http.ListenAndServe(":8080", nil)
	}

Configuration

Refer to the variables section of the documentation: http://godoc.org/github.com/MiniProfiler/go/miniprofiler#pkg-variables.

Other implementations and resources: http://miniprofiler.com.

Frameworks

Various frameworks have explicit support.

Google App Engine: http://godoc.org/github.com/MiniProfiler/go/miniprofiler_gae

Revel: http://godoc.org/github.com/MiniProfiler/go/miniprofiler_revel

Martini: http://godoc.org/github.com/MiniProfiler/go/miniprofiler_martini

Beego: http://godoc.org/github.com/MiniProfiler/go/miniprofiler_beego

Traffic: http://godoc.org/github.com/MiniProfiler/go/miniprofiler_traffic

gocraft/web: http://godoc.org/github.com/MiniProfiler/go/miniprofiler_gocraftweb

RPCs

Various RPCs have explicit support.

Redis: http://godoc.org/github.com/MiniProfiler/go/redis

SQL: http://godoc.org/github.com/MiniProfiler/go/sql
*/
package miniprofiler
