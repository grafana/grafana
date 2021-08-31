import { initialCustomVariableModelState } from 'app/features/variables/custom/reducer';
import { interpolateVariable } from './common';

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
  });
});
