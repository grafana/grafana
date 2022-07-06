import { initialCustomVariableModelState } from 'app/features/variables/custom/reducer';

import { hasOption, interpolateVariable } from './common';

describe('AzureMonitor: hasOption', () => {
  it('can find an option in flat array', () => {
    const options = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
      { value: 'c', label: 'c' },
    ];

    expect(hasOption(options, 'b')).toBeTruthy();
  });

  it('can not find an option in flat array', () => {
    const options = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
      { value: 'c', label: 'c' },
    ];

    expect(hasOption(options, 'not-there')).not.toBeTruthy();
  });

  it('can find an option in a nested group', () => {
    const options = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
      {
        label: 'c',
        value: 'c',
        options: [
          { value: 'c-a', label: 'c-a' },
          { value: 'c-b', label: 'c-b' },
          { value: 'c-c', label: 'c-c' },
        ],
      },
      { value: 'd', label: 'd' },
    ];

    expect(hasOption(options, 'c-b')).toBeTruthy();
  });
});

describe('When interpolating variables', () => {
  describe('and value is a string', () => {
    it('should return an unquoted value', () => {
      expect(interpolateVariable('abc', initialCustomVariableModelState)).toEqual('abc');
    });
  });

  describe('and value is a number', () => {
    it('should return an unquoted value', () => {
      expect(interpolateVariable(1000, initialCustomVariableModelState)).toEqual(1000);
    });
  });

  describe('and value is an array of strings', () => {
    it('should return comma separated quoted values', () => {
      expect(interpolateVariable(['a', 'b', 'c'], initialCustomVariableModelState)).toEqual("'a','b','c'");
    });
  });

  describe('and variable allows multi-value and value is a string', () => {
    it('should return a quoted value', () => {
      const variable = { ...initialCustomVariableModelState, multi: true };
      expect(interpolateVariable('abc', variable)).toEqual("'abc'");
    });
  });

  describe('and variable contains single quote', () => {
    it('should return a quoted value', () => {
      const variable = { ...initialCustomVariableModelState, multi: true };
      expect(interpolateVariable("a'bc", variable)).toEqual("'a'bc'");
    });
  });

  describe('and variable allows all and value is a string', () => {
    it('should return a quoted value', () => {
      const variable = { ...initialCustomVariableModelState, includeAll: true };
      expect(interpolateVariable('abc', variable)).toEqual("'abc'");
    });

    it('should not return a quoted value if the all value is modified', () => {
      const variable = { ...initialCustomVariableModelState, includeAll: true, allValue: 'All' };
      expect(interpolateVariable('abc', variable)).toEqual('abc');
    });

    it('should return a quoted value if multi is selected even if the allValue is set', () => {
      const variable = { ...initialCustomVariableModelState, includeAll: true, multi: true, allValue: 'All' };
      expect(interpolateVariable('abc', variable)).toEqual("'abc'");
    });
  });
});
