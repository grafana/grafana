slug
====

Package `slug` generate slug from unicode string, URL-friendly slugify with
multiple languages support.

[![GoDoc](https://godoc.org/github.com/gosimple/slug?status.png)](https://godoc.org/github.com/gosimple/slug)
[![Build Status](https://drone.io/github.com/gosimple/slug/status.png)](https://drone.io/github.com/gosimple/slug/latest)

[Documentation online](http://godoc.org/github.com/gosimple/slug)

## Example

	package main

	import(
		"github.com/gosimple/slug"
	    "fmt"
	)

	func main () {
		text := slug.Make("Hellö Wörld хелло ворлд")
		fmt.Println(text) // Will print hello-world-khello-vorld

		someText := slug.Make("影師")
		fmt.Println(someText) // Will print: ying-shi

		enText := slug.MakeLang("This & that", "en")
		fmt.Println(enText) // Will print 'this-and-that'

		deText := slug.MakeLang("Diese & Dass", "de")
		fmt.Println(deText) // Will print 'diese-und-dass'

		slug.CustomSub = map[string]string{
			"water": "sand",
		}
		textSub := slug.Make("water is hot")
		fmt.Println(textSub) // Will print 'sand-is-hot'
	}

### Requests or bugs?
<https://github.com/gosimple/slug/issues>

## Installation

	go get -u github.com/gosimple/slug

## License

The source files are distributed under the
[Mozilla Public License, version 2.0](http://mozilla.org/MPL/2.0/),
unless otherwise noted.
Please read the [FAQ](http://www.mozilla.org/MPL/2.0/FAQ.html)
if you have further questions regarding the license.
