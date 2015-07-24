# assertions
--
    import "github.com/smartystreets/assertions"

Package assertions contains the implementations for all assertions which are
referenced in goconvey's `convey` package
(github.com/smartystreets/goconvey/convey) for use with the So(...) method. They
can also be used in traditional Go test functions and even in applicaitons.

## Usage

#### func  So

```go
func So(actual interface{}, assert assertion, expected ...interface{}) (bool, string)
```
So is a convenience function for running assertions on arbitrary arguments in
any context, be it for testing or even application logging. It allows you to
perform assertion-like behavior (and get nicely formatted messages detailing
discrepancies) but without the program blowing up or panicking. All that is
required is to import this package and call `So` with one of the assertions
exported by this package as the second parameter. The first return parameter is
a boolean indicating if the assertion was true. The second return parameter is
the well-formatted message showing why an assertion was incorrect, or blank if
the assertion was correct.

Example:

    if ok, message := So(x, ShouldBeGreaterThan, y); !ok {
         log.Println(message)
    }

#### func  GoConveyMode

```go
func GoConveyMode(yes bool)
```
GoConveyMode provides control over JSON serialization of failures. When using
the assertions in this package from the convey package JSON results are very
helpful and can be rendered in a DIFF view. In that case, this function will be
called with a true value to enable the JSON serialization. By default, the
assertions in this package will not serializer a JSON result, making standalone
ussage more convenient.

#### func  ShouldAlmostEqual

```go
func ShouldAlmostEqual(actual interface{}, expected ...interface{}) string
```
ShouldAlmostEqual makes sure that two parameters are close enough to being
equal. The acceptable delta may be specified with a third argument, or a very
small default delta will be used.

#### func  ShouldBeBetween

```go
func ShouldBeBetween(actual interface{}, expected ...interface{}) string
```
ShouldBeBetween receives exactly three parameters: an actual value, a lower
bound, and an upper bound. It ensures that the actual value is between both
bounds (but not equal to either of them).

#### func  ShouldBeBetweenOrEqual

```go
func ShouldBeBetweenOrEqual(actual interface{}, expected ...interface{}) string
```
ShouldBeBetweenOrEqual receives exactly three parameters: an actual value, a
lower bound, and an upper bound. It ensures that the actual value is between
both bounds or equal to one of them.

#### func  ShouldBeBlank

```go
func ShouldBeBlank(actual interface{}, expected ...interface{}) string
```
ShouldBeBlank receives exactly 1 string parameter and ensures that it is equal
to "".

#### func  ShouldBeChronological

```go
func ShouldBeChronological(actual interface{}, expected ...interface{}) string
```
ShouldBeChronological receives a []time.Time slice and asserts that the are in
chronological order starting with the first time.Time as the earliest.

#### func  ShouldBeEmpty

```go
func ShouldBeEmpty(actual interface{}, expected ...interface{}) string
```
ShouldBeEmpty receives a single parameter (actual) and determines whether or not
calling len(actual) would return `0`. It obeys the rules specified by the len
function for determining length: http://golang.org/pkg/builtin/#len

#### func  ShouldBeFalse

```go
func ShouldBeFalse(actual interface{}, expected ...interface{}) string
```
ShouldBeFalse receives a single parameter and ensures that it is false.

#### func  ShouldBeGreaterThan

```go
func ShouldBeGreaterThan(actual interface{}, expected ...interface{}) string
```
ShouldBeGreaterThan receives exactly two parameters and ensures that the first
is greater than the second.

#### func  ShouldBeGreaterThanOrEqualTo

```go
func ShouldBeGreaterThanOrEqualTo(actual interface{}, expected ...interface{}) string
```
ShouldBeGreaterThanOrEqualTo receives exactly two parameters and ensures that
the first is greater than or equal to the second.

#### func  ShouldBeIn

```go
func ShouldBeIn(actual interface{}, expected ...interface{}) string
```
ShouldBeIn receives at least 2 parameters. The first is a proposed member of the
collection that is passed in either as the second parameter, or of the
collection that is comprised of all the remaining parameters. This assertion
ensures that the proposed member is in the collection (using ShouldEqual).

#### func  ShouldBeLessThan

```go
func ShouldBeLessThan(actual interface{}, expected ...interface{}) string
```
ShouldBeLessThan receives exactly two parameters and ensures that the first is
less than the second.

#### func  ShouldBeLessThanOrEqualTo

```go
func ShouldBeLessThanOrEqualTo(actual interface{}, expected ...interface{}) string
```
ShouldBeLessThan receives exactly two parameters and ensures that the first is
less than or equal to the second.

#### func  ShouldBeNil

```go
func ShouldBeNil(actual interface{}, expected ...interface{}) string
```
ShouldBeNil receives a single parameter and ensures that it is nil.

#### func  ShouldBeTrue

```go
func ShouldBeTrue(actual interface{}, expected ...interface{}) string
```
ShouldBeTrue receives a single parameter and ensures that it is true.

#### func  ShouldBeZeroValue

```go
func ShouldBeZeroValue(actual interface{}, expected ...interface{}) string
```
ShouldBeZeroValue receives a single parameter and ensures that it is the Go
equivalent of the default value, or "zero" value.

#### func  ShouldContain

```go
func ShouldContain(actual interface{}, expected ...interface{}) string
```
ShouldContain receives exactly two parameters. The first is a slice and the
second is a proposed member. Membership is determined using ShouldEqual.

#### func  ShouldContainSubstring

```go
func ShouldContainSubstring(actual interface{}, expected ...interface{}) string
```
ShouldContainSubstring receives exactly 2 string parameters and ensures that the
first contains the second as a substring.

#### func  ShouldEndWith

```go
func ShouldEndWith(actual interface{}, expected ...interface{}) string
```
ShouldEndWith receives exactly 2 string parameters and ensures that the first
ends with the second.

#### func  ShouldEqual

```go
func ShouldEqual(actual interface{}, expected ...interface{}) string
```
ShouldEqual receives exactly two parameters and does an equality check.

#### func  ShouldHappenAfter

```go
func ShouldHappenAfter(actual interface{}, expected ...interface{}) string
```
ShouldHappenAfter receives exactly 2 time.Time arguments and asserts that the
first happens after the second.

#### func  ShouldHappenBefore

```go
func ShouldHappenBefore(actual interface{}, expected ...interface{}) string
```
ShouldHappenBefore receives exactly 2 time.Time arguments and asserts that the
first happens before the second.

#### func  ShouldHappenBetween

```go
func ShouldHappenBetween(actual interface{}, expected ...interface{}) string
```
ShouldHappenBetween receives exactly 3 time.Time arguments and asserts that the
first happens between (not on) the second and third.

#### func  ShouldHappenOnOrAfter

```go
func ShouldHappenOnOrAfter(actual interface{}, expected ...interface{}) string
```
ShouldHappenOnOrAfter receives exactly 2 time.Time arguments and asserts that
the first happens on or after the second.

#### func  ShouldHappenOnOrBefore

```go
func ShouldHappenOnOrBefore(actual interface{}, expected ...interface{}) string
```
ShouldHappenOnOrBefore receives exactly 2 time.Time arguments and asserts that
the first happens on or before the second.

#### func  ShouldHappenOnOrBetween

```go
func ShouldHappenOnOrBetween(actual interface{}, expected ...interface{}) string
```
ShouldHappenOnOrBetween receives exactly 3 time.Time arguments and asserts that
the first happens between or on the second and third.

#### func  ShouldHappenWithin

```go
func ShouldHappenWithin(actual interface{}, expected ...interface{}) string
```
ShouldHappenWithin receives a time.Time, a time.Duration, and a time.Time (3
arguments) and asserts that the first time.Time happens within or on the
duration specified relative to the other time.Time.

#### func  ShouldHaveSameTypeAs

```go
func ShouldHaveSameTypeAs(actual interface{}, expected ...interface{}) string
```
ShouldHaveSameTypeAs receives exactly two parameters and compares their
underlying types for equality.

#### func  ShouldImplement

```go
func ShouldImplement(actual interface{}, expectedList ...interface{}) string
```
ShouldImplement receives exactly two parameters and ensures that the first
implements the interface type of the second.

#### func  ShouldNotAlmostEqual

```go
func ShouldNotAlmostEqual(actual interface{}, expected ...interface{}) string
```
ShouldNotAlmostEqual is the inverse of ShouldAlmostEqual

#### func  ShouldNotBeBetween

```go
func ShouldNotBeBetween(actual interface{}, expected ...interface{}) string
```
ShouldNotBeBetween receives exactly three parameters: an actual value, a lower
bound, and an upper bound. It ensures that the actual value is NOT between both
bounds.

#### func  ShouldNotBeBetweenOrEqual

```go
func ShouldNotBeBetweenOrEqual(actual interface{}, expected ...interface{}) string
```
ShouldNotBeBetweenOrEqual receives exactly three parameters: an actual value, a
lower bound, and an upper bound. It ensures that the actual value is nopt
between the bounds nor equal to either of them.

#### func  ShouldNotBeBlank

```go
func ShouldNotBeBlank(actual interface{}, expected ...interface{}) string
```
ShouldNotBeBlank receives exactly 1 string parameter and ensures that it is
equal to "".

#### func  ShouldNotBeEmpty

```go
func ShouldNotBeEmpty(actual interface{}, expected ...interface{}) string
```
ShouldNotBeEmpty receives a single parameter (actual) and determines whether or
not calling len(actual) would return a value greater than zero. It obeys the
rules specified by the `len` function for determining length:
http://golang.org/pkg/builtin/#len

#### func  ShouldNotBeIn

```go
func ShouldNotBeIn(actual interface{}, expected ...interface{}) string
```
ShouldNotBeIn receives at least 2 parameters. The first is a proposed member of
the collection that is passed in either as the second parameter, or of the
collection that is comprised of all the remaining parameters. This assertion
ensures that the proposed member is NOT in the collection (using ShouldEqual).

#### func  ShouldNotBeNil

```go
func ShouldNotBeNil(actual interface{}, expected ...interface{}) string
```
ShouldNotBeNil receives a single parameter and ensures that it is not nil.

#### func  ShouldNotContain

```go
func ShouldNotContain(actual interface{}, expected ...interface{}) string
```
ShouldNotContain receives exactly two parameters. The first is a slice and the
second is a proposed member. Membership is determinied using ShouldEqual.

#### func  ShouldNotContainSubstring

```go
func ShouldNotContainSubstring(actual interface{}, expected ...interface{}) string
```
ShouldNotContainSubstring receives exactly 2 string parameters and ensures that
the first does NOT contain the second as a substring.

#### func  ShouldNotEndWith

```go
func ShouldNotEndWith(actual interface{}, expected ...interface{}) string
```
ShouldEndWith receives exactly 2 string parameters and ensures that the first
does not end with the second.

#### func  ShouldNotEqual

```go
func ShouldNotEqual(actual interface{}, expected ...interface{}) string
```
ShouldNotEqual receives exactly two parameters and does an inequality check.

#### func  ShouldNotHappenOnOrBetween

```go
func ShouldNotHappenOnOrBetween(actual interface{}, expected ...interface{}) string
```
ShouldNotHappenOnOrBetween receives exactly 3 time.Time arguments and asserts
that the first does NOT happen between or on the second or third.

#### func  ShouldNotHappenWithin

```go
func ShouldNotHappenWithin(actual interface{}, expected ...interface{}) string
```
ShouldNotHappenWithin receives a time.Time, a time.Duration, and a time.Time (3
arguments) and asserts that the first time.Time does NOT happen within or on the
duration specified relative to the other time.Time.

#### func  ShouldNotHaveSameTypeAs

```go
func ShouldNotHaveSameTypeAs(actual interface{}, expected ...interface{}) string
```
ShouldNotHaveSameTypeAs receives exactly two parameters and compares their
underlying types for inequality.

#### func  ShouldNotImplement

```go
func ShouldNotImplement(actual interface{}, expectedList ...interface{}) string
```
ShouldNotImplement receives exactly two parameters and ensures that the first
does NOT implement the interface type of the second.

#### func  ShouldNotPanic

```go
func ShouldNotPanic(actual interface{}, expected ...interface{}) (message string)
```
ShouldNotPanic receives a void, niladic function and expects to execute the
function without any panic.

#### func  ShouldNotPanicWith

```go
func ShouldNotPanicWith(actual interface{}, expected ...interface{}) (message string)
```
ShouldNotPanicWith receives a void, niladic function and expects to recover a
panic whose content differs from the second argument.

#### func  ShouldNotPointTo

```go
func ShouldNotPointTo(actual interface{}, expected ...interface{}) string
```
ShouldNotPointTo receives exactly two parameters and checks to see that they
point to different addresess.

#### func  ShouldNotResemble

```go
func ShouldNotResemble(actual interface{}, expected ...interface{}) string
```
ShouldNotResemble receives exactly two parameters and does an inverse deep equal
check (see reflect.DeepEqual)

#### func  ShouldNotStartWith

```go
func ShouldNotStartWith(actual interface{}, expected ...interface{}) string
```
ShouldNotStartWith receives exactly 2 string parameters and ensures that the
first does not start with the second.

#### func  ShouldPanic

```go
func ShouldPanic(actual interface{}, expected ...interface{}) (message string)
```
ShouldPanic receives a void, niladic function and expects to recover a panic.

#### func  ShouldPanicWith

```go
func ShouldPanicWith(actual interface{}, expected ...interface{}) (message string)
```
ShouldPanicWith receives a void, niladic function and expects to recover a panic
with the second argument as the content.

#### func  ShouldPointTo

```go
func ShouldPointTo(actual interface{}, expected ...interface{}) string
```
ShouldPointTo receives exactly two parameters and checks to see that they point
to the same address.

#### func  ShouldResemble

```go
func ShouldResemble(actual interface{}, expected ...interface{}) string
```
ShouldResemble receives exactly two parameters and does a deep equal check (see
reflect.DeepEqual)

#### func  ShouldStartWith

```go
func ShouldStartWith(actual interface{}, expected ...interface{}) string
```
ShouldStartWith receives exactly 2 string parameters and ensures that the first
starts with the second.

#### type Serializer

```go
type Serializer interface {
	// contains filtered or unexported methods
}
```
