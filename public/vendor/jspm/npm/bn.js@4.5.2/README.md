# <img src="./logo.png" alt="bn.js" width="160" height="160" />

> BigNum in pure javascript

[![Build Status](https://secure.travis-ci.org/indutny/bn.js.png)](http://travis-ci.org/indutny/bn.js)

## Install
`npm install --save bn.js`

## Usage

```js
const BN = require('bn.js');

var a = new BN('dead', 16);
var b = new BN('101010', 2);

var res = a.add(b);
console.log(res.toString(10));  // 57047
```

## Notation

### Prefixes

There are several prefixes to instructions that affect the way the work. Here
is the list of them in the order of appearance in the function name:

* `i` - perform operation in-place, storing the result in the host object (on
  which the method was invoked). Might be used to avoid number allocation costs
* `u` - unsigned, ignore the sign of operands when performing operation, or
  always return positive value. Second case applies to reduction operations
  like `mod()`. In such cases if the result will be negative - modulo will be
  added to the result to make it positive

### Postfixes

The only available postfix at the moment is:

* `n` - which means that the argument of the function must be a plain JavaScript
  number

### Examples

* `a.iadd(b)` - perform addition on `a` and `b`, storing the result in `a`
* `a.pmod(b)` - reduce `a` modulo `b`, returning positive value
* `a.iushln(13)` - shift bits of `a` left by 13

## Instructions

Prefixes/postfixes are put in parens at the of the line. `endian` - could be
either `le` (little-endian) or `be` (big-endian).

### Utilities

* `a.clone()` - clone number
* `a.toArray(endian, length)` - convert to byte array, and optionally zero
  pad to length, throwing if already exceeding
* `a.toString(base, padding)` - convert to base-string and pad with zeroes
* `a.toNumber()` - convert to Javascript Number (limited to 53 bits)
* `a.bitLength()` - get number of bits occupied
* `a.zeroBits()` - return number of less-significant consequent zero bits
  (example: `1010000` has 4 zero bits)
* `a.byteLength()` - return number of bytes occupied
* `a.isNeg()` - true if the number is negative
* `a.isEven()` - no comments
* `a.isOdd()` - no comments
* `a.isZero()` - no comments
* `a.cmp(b)` - compare numbers and return `-1` (a `<` b), `0` (a `==` b), or `1` (a `>` b)
  depending on the comparison result (`ucmp`, `cmpn`)

### Arithmetics

* `a.neg()` - negate sign (`i`)
* `a.abs()` - absolute value (`i`)
* `a.add(b)` - addition (`i`, `n`)
* `a.sub(b)` - subtraction (`i`, `n`)
* `a.mul(b)` - multiply (`i`, `n`)
* `a.sqr()` - square (`i`)
* `a.pow(b)` - raise `a` to the power of `b`
* `a.div(b)` - divide (`divn`, `idivn`)
* `a.mod(b)` - reduct (`u`, `n`)
* `a.divRound(b)` - rounded division

### Bit operations

* `a.or(b)` - or (`i`, `u`)
* `a.and(b)` - and (`i`, `u`, `andln`) (NOTE: `andln` is going to be replaced
  with `andn` in future)
* `a.xor(b)` - xor (`i`, `u`)
* `a.setn(b)` - set specified bit to `1`
* `a.shln(b)` - shift left (`i`, `u`)
* `a.shrn(b)` - shift right (`i`, `u`)
* `a.testn(b)` - test if specified bit is set
* `a.maskn(b)` - clear bits with indexes higher or equal to `b` (`i`)
* `a.bincn(b)` - add `1 << b` to the number

### Reduction

* `a.gcd(b)` - GCD
* `a.egcd(b)` - Extended GCD results (`{ a: ..., b: ..., gcd: ... }`)
* `a.invm(b)` - inverse `a` modulo `b`

## Fast reduction

When doing lots of reductions using the same modulo, it might be beneficial to
use some tricks: like [Montgomery multiplication][0], or using special algorithm
for [Mersenne Prime][1].

### Reduction context

To enable this tricks one should create a reduction context:

```js
var red = BN.red(num);
```
where `num` is just a BN instance.

Or:

```js
var red = BN.red(primeName);
```

Where `primeName` is either of these [Mersenne Primes][1]:

* `'k256'`
* `'p224'`
* `'p192'`
* `'p25519'`

Or:

```js
var red = BN.mont(num);
```

To reduce numbers with [Montgomery trick][1]. `.mont()` is generally faster than
`.red(num)`, but slower than `BN.red(primeName)`.

### Converting numbers

Before performing anything in reduction context - numbers should be converted
to it. Usually, this means that one should:

* Convert inputs to reducted ones
* Operate on them in reduction context
* Convert outputs back from the reduction context

Here is how one may convert numbers to `red`:

```js
var redA = a.toRed(red);
```
Where `red` is a reduction context created using instructions above

Here is how to convert them back:

```js
var a = redA.fromRed();
```

### Red instructions

Most of the instructions from the very start of this readme have their
counterparts in red context:

* `a.redAdd(b)`, `a.redIAdd(b)`
* `a.redSub(b)`, `a.redISub(b)`
* `a.redShl(num)`
* `a.redMul(b)`, `a.redIMul(b)`
* `a.redSqr()`, `a.redISqr()`
* `a.redSqrt()` - square root modulo reduction context's prime
* `a.redInvm()` - modular inverse of the number
* `a.redNeg()`
* `a.redPow(b)` - modular exponentiation

## LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2015.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

[0]: https://en.wikipedia.org/wiki/Montgomery_modular_multiplication
[1]: https://en.wikipedia.org/wiki/Mersenne_prime
