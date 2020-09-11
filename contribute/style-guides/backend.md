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

### Line length and indentation

We don't restrict the line length to any strict number of columns, but
have found that lines which exceeds 100 columns in width are often bad
for the code's legibility. We're not strict about this, as a slightly
longer line can sometimes be preferable to splitting it up.

In addition to that, constants where the content is uninteresting to the
reader can be several hundred columns wide without being a concern.
Examples of this can be test strings, static user-facing error messages,
or cryptographic public keys which are illegible for people regardless
of length.

Gofmt requires all indentation to be tabs in Go and assumes a width of
eight spaces for a tab. We recommend that you set your tab width to
your personal preference between four and eight spaces.

Keeping the indentation level as low as possible, particularly for the
most critical flow of your code, is very valuable and nested
loops and conditionals should be kept to a minimum.

When a function declaration creates a line so long that it becomes hard
to read, we recommend putting every argument on its own line, see example
below.

```go
func Function(prefix string, str string, suffix string, validation func(string) error, finalize func(string) string) (string, error) {
```

becomes

```go
func Function(
	prefix string,
	str string,
	suffix string,
	validation func(string) error,
	finalize func(string) string,
) (string, error) {
```

When a function grows beyond a reasonable line length, it is often
possible to improve the legibility of its calls by either passing it
a struct with its arguments or by implementing functional options.

```go
type FunctionArguments struct {
	prefix string
	suffix string
	validation func(string) error
	finalize func(string) string
}

func Function(str string, args FunctionArguments) (string, error) {
```

or

```go
type FunctionOpts func(string) (string, error)

func Function(str string, opts ...FunctionOpts)
```

## Introducing new dependencies

We avoid introducing new dependencies unless necessary. The introduction
of a new dependency adds additional ongoing maintenance costs and risks
increasing the complexity of code reviews significantly.

As a guideline, a dependency needs to be both reputable and solve a
complicated problem to be added to Grafana.

Exempt from these guidelines are our own libraries and those which are
part of the Go project but not part of the main Go tree, a.k.a. the
`golang.org/x` packages.

## Testing

We value clean and readable code, that is loosely coupled and covered by unit tests. This makes it easier to collaborate and maintain the code.

Tests must use the standard library, `testing`. For assertions, prefer using [testify](https://github.com/stretchr/testify).

The majority of our tests uses [GoConvey](http://goconvey.co/) but that's something we want to avoid going forward.

In the `sqlstore` package we do database operations in tests and while some might say that's not suited for unit tests. We think they are fast enough and provide a lot of value.

### Database integration tests

By default, tests which depend on a database will only run under an
inmemory SQLite store. For tests which tests database operations
directly, we want to test those tests 
We require the first line of integration test files to be exactly:

```
// +build integration
```

By convention, these tests are suffixed by  `_integration_test.go`.
