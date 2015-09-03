## go-nsq

The official Go package for [NSQ][nsq].

[![Build Status](https://secure.travis-ci.org/nsqio/go-nsq.png?branch=master)][travis] [![GoDoc](https://godoc.org/github.com/nsqio/go-nsq?status.svg)](https://godoc.org/github.com/nsqio/go-nsq)

The latest stable release is **[1.0.4][latest_tag]**

NOTE: The public API has been refactored as of `v1.0.0` and is not backwards compatible with
previous releases. **[0.3.7][legacy]** is the last stable release compatible with the legacy API.
Please read the [UPGRADING](UPGRADING.md) guide.

### Docs

See [godoc][nsq_gopkgdoc].

See the [main repo apps][apps] directory for examples of clients built using this package.

[nsq]: https://github.com/nsqio/nsq
[nsq_gopkgdoc]: http://godoc.org/github.com/nsqio/go-nsq
[apps]: https://github.com/nsqio/nsq/tree/master/apps
[consumer]: http://godoc.org/github.com/nsqio/go-nsq#Consumer
[producer]: http://godoc.org/github.com/nsqio/go-nsq#Producer
[pr30]: https://github.com/nsqio/go-nsq/pull/30
[legacy]: https://github.com/nsqio/go-nsq/releases/tag/v0.3.7
[travis]: http://travis-ci.org/nsqio/go-nsq
[latest_tag]: https://github.com/nsqio/go-nsq/releases/tag/v1.0.4
