`ogletest` is a unit testing framework for Go with the following features:

 *  An extensive and extensible set of matchers for expressing expectations.
 *  Automatic failure messages; no need to say `t.Errorf("Expected %v, got
    %v"...)`.
 *  Clean, readable output that tells you exactly what you need to know.
 *  Built-in support for mocking through the [oglemock][] package.
 *  Style and semantics similar to [Google Test][googletest] and
    [Google JS Test][google-js-test].

It integrates with Go's built-in `testing` package, so it works with the
`go test` command, and even with other types of test within your package. Unlike
the `testing` package which offers only basic capabilities for signalling
failures, it offers ways to express expectations and get nice failure messages
automatically.


Installation
------------

First, make sure you have installed Go 1.0.2 or newer. See
[here][golang-install] for instructions.

Use the following command to install `ogletest` and its dependencies, and to
keep them up to date:

    go get -u github.com/smartystreets/goconvey/convey/assertions/ogletest


Documentation
-------------

See [here][reference] for package documentation hosted on GoPkgDoc containing an
exhaustive list of exported symbols. Alternatively, you can install the package
and then use `go doc`:

    go doc github.com/smartystreets/goconvey/convey/assertions/ogletest

An important part of `ogletest` is its use of matchers provided by the
[oglematchers][matcher-reference] package. See that package's documentation
for information on the built-in matchers available, and check out the
`oglematchers.Matcher` interface if you want to define your own.


Example
-------

Let's say you have a function in your package `people` with the following
signature:

```go
// GetRandomPerson returns the name and phone number of Tony, Dennis, or Scott.
func GetRandomPerson() (name, phone string) {
  [...]
}
```

A silly function, but it will do for an example. You can write a couple of tests
for it as follows:

```go
package people

import (
  "github.com/smartystreets/goconvey/convey/assertions/oglematchers"
  "github.com/smartystreets/goconvey/convey/assertions/ogletest"
  "testing"
)

// Give ogletest a chance to run your tests when invoked by 'go test'.
func TestOgletest(t *testing.T) { ogletest.RunTests(t) }

// Create a test suite, which groups together logically related test methods
// (defined below). You can share common setup and teardown code here; see the
// package docs for more info.
type PeopleTest struct {}
func init() { ogletest.RegisterTestSuite(&PeopleTest{}) }

func (t *PeopleTest) ReturnsCorrectNames() {
  // Call the function a few times, and make sure it never strays from the set
  // of expected names.
  for i := 0; i < 25; i++ {
    name, _ := GetRandomPerson()
    ogletest.ExpectThat(name, oglematchers.AnyOf("Tony", "Dennis", "Scott"))
  }
}

func (t *PeopleTest) FormatsPhoneNumbersCorrectly() {
  // Call the function a few times, and make sure it returns phone numbers in a
  // standard US format.
  for i := 0; i < 25; i++ {
    _, phone := GetRandomPerson()
    ogletest.ExpectThat(phone, oglematchers.MatchesRegexp(`^\(\d{3}\) \d{3}-\d{4}$`))
}
```

Note that test control functions (`RunTests`, `ExpectThat`, and so on) are part
of the `ogletest` package, whereas built-in matchers (`AnyOf`, `MatchesRegexp`,
and more) are part of the [oglematchers][matcher-reference] library. You can of
course use dot imports so that you don't need to prefix each function with its
package name:

```go
import (
  . "github.com/smartystreets/goconvey/convey/assertions/oglematchers"
  . "github.com/smartystreets/goconvey/convey/assertions/ogletest"
)
```

If you save the test in a file whose name ends in `_test.go`, you can run your
tests by simply invoking the following in your package directory:

    go test

Here's what the failure output of ogletest looks like, if your function's
implementation is bad.

    [----------] Running tests from PeopleTest
    [ RUN      ] PeopleTest.FormatsPhoneNumbersCorrectly
    people_test.go:32:
    Expected: matches regexp "^\(\d{3}\) \d{3}-\d{4}$"
    Actual:   +1 800 555 5555
    
    [  FAILED  ] PeopleTest.FormatsPhoneNumbersCorrectly
    [ RUN      ] PeopleTest.ReturnsCorrectNames
    people_test.go:23:
    Expected: or(Tony, Dennis, Scott)
    Actual:   Bart
    
    [  FAILED  ] PeopleTest.ReturnsCorrectNames
    [----------] Finished with tests from PeopleTest

And if the test passes:

    [----------] Running tests from PeopleTest
    [ RUN      ] PeopleTest.FormatsPhoneNumbersCorrectly
    [       OK ] PeopleTest.FormatsPhoneNumbersCorrectly
    [ RUN      ] PeopleTest.ReturnsCorrectNames
    [       OK ] PeopleTest.ReturnsCorrectNames
    [----------] Finished with tests from PeopleTest


[reference]: http://gopkgdoc.appspot.com/pkg/github.com/smartystreets/goconvey/convey/assertions/ogletest
[matcher-reference]: http://gopkgdoc.appspot.com/pkg/github.com/smartystreets/goconvey/convey/assertions/oglematchers
[golang-install]: http://golang.org/doc/install.html
[googletest]: http://code.google.com/p/googletest/
[google-js-test]: http://code.google.com/p/google-js-test/
[howtowrite]: http://golang.org/doc/code.html
[oglemock]: https://github.com/smartystreets/goconvey/convey/assertions/oglemock
