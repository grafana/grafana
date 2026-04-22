import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from '../variables/constants';

import { LegacyVariableWrapper } from './LegacyVariableWrapper';

const makeVariable = (name = 'test', type = 'query') => ({ name, type } as any);

describe('LegacyVariableWrapper', () => {
  describe('getValue', () => {
    it('returns a string value as-is', () => {
      const wrapper = new LegacyVariableWrapper(makeVariable(), 'server1', 'server1');
      expect(wrapper.getValue('')).toBe('server1');
    });

    it('returns a number value as-is', () => {
      const wrapper = new LegacyVariableWrapper(makeVariable(), 42, '42');
      expect(wrapper.getValue('')).toBe(42);
    });

    it('returns a boolean value as-is', () => {
      const wrapper = new LegacyVariableWrapper(makeVariable(), true, 'true');
      expect(wrapper.getValue('')).toBe(true);
    });

    it('returns an array as-is without coercing to string', () => {
      const value = ['server1', 'server2'];
      const wrapper = new LegacyVariableWrapper(makeVariable(), value, value);
      expect(wrapper.getValue('')).toEqual(['server1', 'server2']);
      expect(Array.isArray(wrapper.getValue(''))).toBe(true);
    });

    it('does not join array values into a comma-separated string', () => {
      const value = ['a', 'b', 'c'];
      const wrapper = new LegacyVariableWrapper(makeVariable(), value, value);
      expect(wrapper.getValue('')).not.toBe('a,b,c');
    });
  });

  describe('getValueText', () => {
    it('returns text when text is a string', () => {
      const wrapper = new LegacyVariableWrapper(makeVariable(), 'server1', 'Server 1');
      expect(wrapper.getValueText()).toBe('Server 1');
    });

    it('returns ALL_VARIABLE_TEXT when value is ALL_VARIABLE_VALUE', () => {
      const wrapper = new LegacyVariableWrapper(makeVariable(), ALL_VARIABLE_VALUE, 'All');
      expect(wrapper.getValueText()).toBe(ALL_VARIABLE_TEXT);
    });

    it('joins array text values with " + "', () => {
      const wrapper = new LegacyVariableWrapper(makeVariable(), ['s1', 's2'], ['Server 1', 'Server 2']);
      expect(wrapper.getValueText()).toBe('Server 1 + Server 2');
    });

    it('falls back to String() for non-string non-array text without logging', () => {
      const spy = jest.spyOn(console, 'log');
      const wrapper = new LegacyVariableWrapper(makeVariable(), 99, 99 as any);
      expect(wrapper.getValueText()).toBe('99');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
