`oglematchers` is a package for the Go programming language containing a set of
matchers, useful in a testing or mocking framework, inspired by and mostly
compatible with [Google Test][googletest] for C++ and
[Google JS Test][google-js-test]. The package is used by the
[ogletest][ogletest] testing framework and [oglemock][oglemock] mocking
framework, which may be more directly useful to you, but can be generically used
elsewhere as well.

A "matcher" is simply an object with a `Matches` method defining a set of golang
values matched by the matcher, and a `Description` method describing that set.
For example, here are some matchers:

```go
// Numbers
Equals(17.13)
LessThan(19)

// Strings
Equals("taco")
HasSubstr("burrito")
MatchesRegex("t.*o")

// Combining matchers
AnyOf(LessThan(17), GreaterThan(19))
```

There are lots more; see [here][reference] for a reference. You can also add
your own simply by implementing the `oglematchers.Matcher` interface.


Installation
------------

First, make sure you have installed Go 1.0.2 or newer. See
[here][golang-install] for instructions.

Use the following command to install `oglematchers` and keep it up to date:

    go get -u github.com/smartystreets/assertions/internal/oglematchers


Documentation
-------------

See [here][reference] for documentation hosted on GoPkgDoc. Alternatively, you
can install the package and then use `go doc`:

    go doc github.com/smartystreets/assertions/internal/oglematchers


[reference]: http://gopkgdoc.appspot.com/pkg/github.com/smartystreets/assertions/internal/oglematchers
[golang-install]: http://golang.org/doc/install.html
[googletest]: http://code.google.com/p/googletest/
[google-js-test]: http://code.google.com/p/google-js-test/
[ogletest]: http://github.com/smartystreets/assertions/internal/ogletest
[oglemock]: http://github.com/smartystreets/assertions/internal/oglemock
