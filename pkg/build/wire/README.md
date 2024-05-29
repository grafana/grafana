# Wire: Automated Initialization in Go

[![Build Status](https://github.com/google/wire/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/google/wire/actions)
[![godoc](https://godoc.org/github.com/google/wire?status.svg)][godoc]
[![Coverage](https://codecov.io/gh/google/wire/branch/master/graph/badge.svg)](https://codecov.io/gh/google/wire)


Wire is a code generation tool that automates connecting components using
[dependency injection][]. Dependencies between components are represented in
Wire as function parameters, encouraging explicit initialization instead of
global variables. Because Wire operates without runtime state or reflection,
code written to be used with Wire is useful even for hand-written
initialization.

For an overview, see the [introductory blog post][].

[dependency injection]: https://en.wikipedia.org/wiki/Dependency_injection
[introductory blog post]: https://blog.golang.org/wire
[godoc]: https://godoc.org/github.com/google/wire
[travis]: https://travis-ci.com/google/wire

## Installing

Install Wire by running:

```shell
go install github.com/google/wire/cmd/wire@latest
```

and ensuring that `$GOPATH/bin` is added to your `$PATH`.

## Documentation

- [Tutorial][]
- [User Guide][]
- [Best Practices][]
- [FAQ][]

[Tutorial]: ./_tutorial/README.md
[Best Practices]: ./docs/best-practices.md
[FAQ]: ./docs/faq.md
[User Guide]: ./docs/guide.md

## Project status

As of version v0.3.0, Wire is *beta* and is considered feature complete. It
works well for the tasks it was designed to perform, and we prefer to keep it
as simple as possible.

We'll not be accepting new features at this time, but will gladly accept bug
reports and fixes.

## Community

For questions, please use [GitHub Discussions](https://github.com/google/wire/discussions).

This project is covered by the Go [Code of Conduct][].

[Code of Conduct]: ./CODE_OF_CONDUCT.md
[go-cloud mailing list]: https://groups.google.com/forum/#!forum/go-cloud
