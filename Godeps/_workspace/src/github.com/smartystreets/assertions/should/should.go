// package should is simply a rewording of the assertion
// functions in the assertions package.
package should

import "github.com/smartystreets/assertions"

var (
	Equal          = assertions.ShouldEqual
	NotEqual       = assertions.ShouldNotEqual
	AlmostEqual    = assertions.ShouldAlmostEqual
	NotAlmostEqual = assertions.ShouldNotAlmostEqual
	Resemble       = assertions.ShouldResemble
	NotResemble    = assertions.ShouldNotResemble
	PointTo        = assertions.ShouldPointTo
	NotPointTo     = assertions.ShouldNotPointTo
	BeNil          = assertions.ShouldBeNil
	NotBeNil       = assertions.ShouldNotBeNil
	BeTrue         = assertions.ShouldBeTrue
	BeFalse        = assertions.ShouldBeFalse
	BeZeroValue    = assertions.ShouldBeZeroValue

	BeGreaterThan          = assertions.ShouldBeGreaterThan
	BeGreaterThanOrEqualTo = assertions.ShouldBeGreaterThanOrEqualTo
	BeLessThan             = assertions.ShouldBeLessThan
	BeLessThanOrEqualTo    = assertions.ShouldBeLessThanOrEqualTo
	BeBetween              = assertions.ShouldBeBetween
	NotBeBetween           = assertions.ShouldNotBeBetween
	BeBetweenOrEqual       = assertions.ShouldBeBetweenOrEqual
	NotBeBetweenOrEqual    = assertions.ShouldNotBeBetweenOrEqual

	Contain    = assertions.ShouldContain
	NotContain = assertions.ShouldNotContain
	BeIn       = assertions.ShouldBeIn
	NotBeIn    = assertions.ShouldNotBeIn
	BeEmpty    = assertions.ShouldBeEmpty
	NotBeEmpty = assertions.ShouldNotBeEmpty

	StartWith           = assertions.ShouldStartWith
	NotStartWith        = assertions.ShouldNotStartWith
	EndWith             = assertions.ShouldEndWith
	NotEndWith          = assertions.ShouldNotEndWith
	BeBlank             = assertions.ShouldBeBlank
	NotBeBlank          = assertions.ShouldNotBeBlank
	ContainSubstring    = assertions.ShouldContainSubstring
	NotContainSubstring = assertions.ShouldNotContainSubstring

	Panic        = assertions.ShouldPanic
	NotPanic     = assertions.ShouldNotPanic
	PanicWith    = assertions.ShouldPanicWith
	NotPanicWith = assertions.ShouldNotPanicWith

	HaveSameTypeAs    = assertions.ShouldHaveSameTypeAs
	NotHaveSameTypeAs = assertions.ShouldNotHaveSameTypeAs
	Implement         = assertions.ShouldImplement
	NotImplement      = assertions.ShouldNotImplement

	HappenBefore         = assertions.ShouldHappenBefore
	HappenOnOrBefore     = assertions.ShouldHappenOnOrBefore
	HappenAfter          = assertions.ShouldHappenAfter
	HappenOnOrAfter      = assertions.ShouldHappenOnOrAfter
	HappenBetween        = assertions.ShouldHappenBetween
	HappenOnOrBetween    = assertions.ShouldHappenOnOrBetween
	NotHappenOnOrBetween = assertions.ShouldNotHappenOnOrBetween
	HappenWithin         = assertions.ShouldHappenWithin
	NotHappenWithin      = assertions.ShouldNotHappenWithin
	BeChronological      = assertions.ShouldBeChronological
)
