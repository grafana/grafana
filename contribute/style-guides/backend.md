# Backend style guide

Grafana's backend has been developed for a long time with a mix of code styles. This guide explains how we want to write Go code in the future.

Unless stated otherwise, use the guidelines listed in the following articles:

- [Effective Go](https://golang.org/doc/effective_go.html)
- [Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- [Go: Best Practices for Production Environments](http://peter.bourgon.org/go-in-production/#formatting-and-style)

## Linting and formatting

To ensure consistency across the Go codebase, we require all code to pass a number of linter checks.

We use the standard following linters:

- [gofmt](https://golang.org/cmd/gofmt/)
- [golint](https://github.com/golang/lint)
- [go vet](https://golang.org/cmd/vet/)

In addition to the standard linters, we also use:

- [revive](https://revive.run/) with a [custom config](https://github.com/grafana/grafana/blob/master/conf/revive.toml)
- [GolangCI-Lint](https://github.com/golangci/golangci-lint)
- [gosec](https://github.com/securego/gosec)

To run all linters, use the `lint-go` Makefile target:

```bash
make lint-go
```

## Testing

We value clean and readable code, that is loosely coupled and covered by unit tests. This makes it easier to collaborate and maintain the code.

Tests must use the standard library, `testing`. For assertions, prefer using [testify](https://github.com/stretchr/testify).

The majority of our tests uses [GoConvey](http://goconvey.co/) but that's something we want to avoid going forward.

In the `sqlstore` package we do database operations in tests and while some might say that's not suited for unit tests. We think they are fast enough and provide a lot of value.
