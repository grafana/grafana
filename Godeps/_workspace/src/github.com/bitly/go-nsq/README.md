## go-nsq

The official Go package for [NSQ][nsq].

[![Build Status](https://secure.travis-ci.org/bitly/go-nsq.png?branch=master)][travis] [![GoDoc](https://godoc.org/github.com/bitly/go-nsq?status.svg)](https://godoc.org/github.com/bitly/go-nsq)

The latest stable release is **[1.0.4][latest_tag]**.

NOTE: The public API has been refactored as of `v1.0.0` and is not backwards compatible with
previous releases. **[0.3.7][legacy]** is the last stable release compatible with the legacy API.
Please read the [UPGRADING](UPGRADING.md) guide.

### Docs

See [godoc][nsq_gopkgdoc].

See the [main repo apps][apps] directory for examples of clients built using this package.

[nsq]: https://github.com/bitly/nsq
[nsq_gopkgdoc]: http://godoc.org/github.com/bitly/go-nsq
[protocol]: http://bitly.github.io/nsq/clients/tcp_protocol_spec.html
[apps]: https://github.com/bitly/nsq/tree/master/apps
[consumer]: http://godoc.org/github.com/bitly/go-nsq#Consumer
[producer]: http://godoc.org/github.com/bitly/go-nsq#Producer
[pr30]: https://github.com/bitly/go-nsq/pull/30
[legacy]: https://github.com/bitly/go-nsq/releases/tag/v0.3.7
[travis]: http://travis-ci.org/bitly/go-nsq
[latest_tag]: https://github.com/bitly/go-nsq/releases/tag/v1.0.4
