import { lastValueFrom } from 'rxjs';

import { CustomVariable } from './CustomVariable';

describe('MultiValueVariable', () => {
  describe('When empty query is provided', () => {
    it('Should default to empty options', async () => {
      const variable = new CustomVariable({
        name: 'test',
        options: [],
        value: '',
        text: '',
        query: '',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toBe('A');
      expect(variable.state.text).toBe('A');
    });
  });

  describe('When invalid query is provided', () => {
    it('Should default to empty options', async () => {
      const variable = new CustomVariable({
        name: 'test',
        options: [],
        value: '',
        text: '',
        query: 'A - B',
      });

      // TODO: Be able to triggger the state update to get the options
      await lastValueFrom(variable.getValueOptions({}));

      expect(variable.state.value).toBe('A');
      expect(variable.state.text).toBe('A');
    });
  });

  describe('When valid query is provided', () => {
    it('Should generate correctly the options for values only', async () => {
      const variable = new CustomVariable({
        name: 'test',
        options: [],
        value: '',
        text: '',
        query: 'A,B,C',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.options).toBe([]);
    });

    it.todo('Should generate options for values and custom text');

    it.todo('Should generate options for values and escaped text values');
  });

  describe('When no value is provided', () => {
    it('Should pick first value', async () => {
      const variable = new CustomVariable({
        name: 'test',
        options: [],
        value: 'A',
        text: 'A',
        query: 'B',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toBe('A');
      expect(variable.state.text).toBe('A');
    });

    it('Should keep current value if current value is valid', async () => {
      const variable = new CustomVariable({
        name: 'test',
        options: [],
        query: 'A',
        value: 'A',
        text: 'A',
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toBe('A');
      expect(variable.state.text).toBe('A');
    });

    it('Should maintain the valid values when multiple selected', async () => {
      const variable = new CustomVariable({
        name: 'test',
        options: [],
        isMulti: true,
        query: 'A,C',
        value: ['A', 'B', 'C'],
        text: ['A', 'B', 'C'],
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toEqual(['A', 'C']);
      expect(variable.state.text).toEqual(['A', 'C']);
    });

    it('Should pick first option if none of the current values are valid', async () => {
      const variable = new CustomVariable({
        name: 'test',
        options: [],
        isMulti: true,
        query: 'A,C',
        value: ['D', 'E'],
        text: ['E', 'E'],
      });

      await lastValueFrom(variable.validateAndUpdate());

      expect(variable.state.value).toEqual(['A']);
      expect(variable.state.text).toEqual(['A']);
    });
  });
});
