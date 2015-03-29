Macaron [![Build Status](https://drone.io/github.com/Unknwon/macaron/status.png)](https://drone.io/github.com/Unknwon/macaron/latest) [![](http://gocover.io/_badge/github.com/Unknwon/macaron)](http://gocover.io/github.com/Unknwon/macaron)
=======================

![Macaron Logo](https://raw.githubusercontent.com/Unknwon/macaron/master/macaronlogo.png)

Package macaron is a high productive and modular design web framework in Go.

##### Current version: 0.5.4

## Getting Started

To install Macaron:

	go get github.com/Unknwon/macaron

The very basic usage of Macaron:

```go
package main

import "github.com/Unknwon/macaron"

func main() {
	m := macaron.Classic()
	m.Get("/", func() string {
		return "Hello world!"
	})
	m.Run()
}
```

## Features

- Powerful routing with suburl.
- Flexible routes combinations.
- Unlimited nested group routers.
- Directly integrate with existing services.
- Dynamically change template files at runtime.
- Allow to use in-memory template and static files.
- Easy to plugin/unplugin features with modular design.
- Handy dependency injection powered by [inject](https://github.com/codegangsta/inject).
- Better router layer and less reflection make faster speed.

## Middlewares

Middlewares allow you easily plugin/unplugin features for your Macaron applications.

There are already many [middlewares](https://github.com/macaron-contrib) to simplify your work:

- gzip - Gzip compression to all requests
- render - Go template engine
- static - Serves static files
- [binding](https://github.com/macaron-contrib/binding) - Request data binding and validation
- [i18n](https://github.com/macaron-contrib/i18n) - Internationalization and Localization
- [cache](https://github.com/macaron-contrib/cache) - Cache manager
- [session](https://github.com/macaron-contrib/session) - Session manager
- [csrf](https://github.com/macaron-contrib/csrf) - Generates and validates csrf tokens
- [captcha](https://github.com/macaron-contrib/captcha) - Captcha service
- [pongo2](https://github.com/macaron-contrib/pongo2) - Pongo2 template engine support
- [sockets](https://github.com/macaron-contrib/sockets) - WebSockets channels binding
- [bindata](https://github.com/macaron-contrib/bindata) - Embed binary data as static and template files
- [toolbox](https://github.com/macaron-contrib/toolbox) - Health check, pprof, profile and statistic services
- [oauth2](https://github.com/macaron-contrib/oauth2) - OAuth 2.0 backend
- [switcher](https://github.com/macaron-contrib/switcher) - Multiple-site support
- [method](https://github.com/macaron-contrib/method) - HTTP method override
- [permissions2](https://github.com/xyproto/permissions2) - Cookies, users and permissions
- [renders](https://github.com/macaron-contrib/renders) - Beego-like render engine(Macaron has built-in template engine, this is another option)

## Use Cases

- [Gogs](https://github.com/gogits/gogs): Go Git Service
- [Gogs Web](https://github.com/gogits/gogsweb): Gogs official website
- [Go Walker](https://gowalker.org): Go online API documentation
- [Switch](https://github.com/gpmgo/switch): Gopm registry
- [YouGam](http://yougam.com): Online Forum
- [Car Girl](http://qcnl.gzsy.com/): Online campaign
- [Critical Stack Intel](https://intel.criticalstack.com/): A 100% free intel marketplace from Critical Stack, Inc.

## Getting Help

- [API Reference](https://gowalker.org/github.com/Unknwon/macaron)
- [Documentation](http://macaron.gogs.io)
- [FAQs](http://macaron.gogs.io/docs/faqs)
- [![Join the chat at https://gitter.im/Unknwon/macaron](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/Unknwon/macaron?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

## Credits

- Basic design of [Martini](https://github.com/go-martini/martini).
- Router layer of [beego](https://github.com/astaxie/beego).
- Logo is modified by [@insionng](https://github.com/insionng) based on [Tribal Dragon](http://xtremeyamazaki.deviantart.com/art/Tribal-Dragon-27005087).

## License

This project is under Apache v2 License. See the [LICENSE](LICENSE) file for the full license text.
