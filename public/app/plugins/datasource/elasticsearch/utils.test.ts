import { removeEmpty, coerceESVersion } from './utils';

describe('removeEmpty', () => {
  it('Should remove all empty', () => {
    const original = {
      stringsShouldBeKept: 'Something',
      unlessTheyAreEmpty: '',
      nullToBeRemoved: null,
      undefinedToBeRemoved: null,
      zeroShouldBeKept: 0,
      booleansShouldBeKept: false,
      emptyObjectsShouldBeRemoved: {},
      emptyArrayShouldBeRemoved: [],
      nonEmptyArraysShouldBeKept: [1, 2, 3],
      nestedObjToBeRemoved: {
        toBeRemoved: undefined,
      },
      nestedObjectToKeep: {
        thisShouldBeRemoved: null,
        thisShouldBeKept: 'Hello, Grafana',
      },
    };

    const expectedResult = {
      stringsShouldBeKept: 'Something',
      zeroShouldBeKept: 0,
      booleansShouldBeKept: false,
      nonEmptyArraysShouldBeKept: [1, 2, 3],
      nestedObjectToKeep: {
        thisShouldBeKept: 'Hello, Grafana',
      },
    };

    expect(removeEmpty(original)).toStrictEqual(expectedResult);
  });

  it('should correctly coerce the version info', () => {
    // valid string
    expect(coerceESVersion('8.1.3')).toBe('8.1.3');

    // invalid string
    expect(coerceESVersion('haha')).toBe('8.0.0');

    // known number
    expect(coerceESVersion(2)).toBe('2.0.0');
    expect(coerceESVersion(5)).toBe('5.0.0');
    expect(coerceESVersion(56)).toBe('5.6.0');
    expect(coerceESVersion(60)).toBe('6.0.0');
    expect(coerceESVersion(70)).toBe('7.0.0');
    expect(coerceESVersion(8)).toBe('8.0.0');

    // unknown number
    expect(coerceESVersion(42)).toBe('8.0.0');

    // undefined
    expect(coerceESVersion(undefined)).toBe('8.0.0');
  });
});
