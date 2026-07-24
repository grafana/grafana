import { isObject, isTruthy } from './data';

describe('isObject', () => {
  it.each([
    // [value, expected]

    // These are objects
    [{}, true],
    [[], true],
    [{ a: 1 }, true],
    [new Date(), true],
    [new Error(), true],

    // These are not!
    [parseInt('blabla', 10), false], // NaN
    [null, false],
    [undefined, false],
    [-Infinity, false],
    [-42, false],
    [0, false],
    [-0, false],
    [42, false],
    [Infinity, false],
    ['foo', false],
    [true, false],
    [Symbol(), false],
    [() => {}, false],
  ])('should return %p for %p', (input, expected) => {
    expect(isObject(input)).toBe(expected);
  });
});

describe('isTruthy', () => {
  it.each([
    // [value, expected]

    // These are truthy
    [true, true],
    [-Infinity, true],
    [-42, true],
    [42, true],
    [Infinity, true],
    ['foo', true],
    [{}, true],
    [[], true],
    [() => {}, true],
    [Symbol(), true],
    [new Date(), true],

    // These are falsy
    [false, false],
    [0, false],
    [-0, false],
    ['', false],
    [null, false],
    [undefined, false],
    [parseInt('blabla', 10), false], // NaN
  ])('should return %p for %p', (input, expected) => {
    expect(isTruthy(input)).toBe(expected);
  });
});
