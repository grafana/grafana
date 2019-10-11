[![Build Status][travis-image]][travis-url]
[![Go Report Card][go-report-image]][go-report-url]

[travis-image]: https://travis-ci.org/go-critic/go-critic.svg?branch=master
[travis-url]: https://travis-ci.org/go-critic/go-critic
[go-report-image]: https://goreportcard.com/badge/github.com/go-critic/go-critic
[go-report-url]: https://goreportcard.com/report/github.com/go-critic/go-critic

## Quick start / Installation / Usage

Install `lintpack`:

```bash
go get -v -u github.com/go-lintpack/lintpack/...
```

Install checkers from [go-critic/checkers](https://github.com/go-critic/checkers):

```bash
# You'll need to have sources under your Go workspace first:
go get -v -u github.com/go-critic/checkers
# Now build a linter that includes all checks from that package:
lintpack build -o gocritic github.com/go-critic/checkers
# Executable gocritic is created and can be used as a standalone linter.
```

Produced binary includes basic help as well as supported checks documentation.

So, the process is simple:

* Get the `lintpack` linter builder
* Build linter from checks implemented in different repos, by various vendors
