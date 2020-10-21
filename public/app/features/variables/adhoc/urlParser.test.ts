import { toFilters, toUrl } from './urlParser';
import { AdHocVariableFilter } from 'app/features/variables/types';
import { UrlQueryValue } from '@grafana/data';

describe('urlParser', () => {
  describe('parsing toUrl with no filters', () => {
    it('then url params should be correct', () => {
      const filters: AdHocVariableFilter[] = [];
      const expected: string[] = [];

      expect(toUrl(filters)).toEqual(expected);
    });
  });

  describe('parsing toUrl with filters', () => {
    it('then url params should be correct', () => {
      const a = createFilter('a');
      const b = createFilter('b', '>');

      const filters: AdHocVariableFilter[] = [a, b];

      const expectedA = `${a.key}|${a.operator}|${a.value}`;
      const expectedB = `${b.key}|${b.operator}|${b.value}`;
      const expected: string[] = [expectedA, expectedB];

      expect(toUrl(filters)).toEqual(expected);
    });
  });

  describe('parsing toUrl with filters containing special chars', () => {
    it('then url params should be correct', () => {
      const a = createFilter('a|');
      const b = createFilter('b', '>');

      const filters: AdHocVariableFilter[] = [a, b];

      const expectedA = `a__gfp__-key|${a.operator}|a__gfp__-value`;
      const expectedB = `${b.key}|${b.operator}|${b.value}`;
      const expected: string[] = [expectedA, expectedB];

      expect(toUrl(filters)).toEqual(expected);
    });
  });

  describe('parsing toUrl with filters without values', () => {
    it('then url params should be correct', () => {
      const a: AdHocVariableFilter = {
        value: '',
        key: 'key',
        operator: '',
        condition: '',
      };

      const filters: AdHocVariableFilter[] = [a];

      const expectedA = `key||`;
      const expected: string[] = [expectedA];

      expect(toUrl(filters)).toEqual(expected);
    });
  });

  describe('parsing toUrl with filters with undefined values', () => {
    it('then url params should be correct', () => {
      const a = ({
        value: undefined,
        key: 'key',
        operator: undefined,
        condition: '',
      } as unknown) as AdHocVariableFilter;

      const filters: AdHocVariableFilter[] = [a];

      const expectedA = `key||`;
      const expected: string[] = [expectedA];

      expect(toUrl(filters)).toEqual(expected);
    });
  });

  describe('parsing toFilters with url containing no filters as string', () => {
    it('then url params should be correct', () => {
      const url: UrlQueryValue = '';
      const expected: AdHocVariableFilter[] = [];
      expect(toFilters(url)).toEqual(expected);
    });
  });

  describe('parsing toFilters with url containing no filters as []', () => {
    it('then url params should be correct', () => {
      const url: UrlQueryValue = [];
      const expected: AdHocVariableFilter[] = [];
      expect(toFilters(url)).toEqual(expected);
    });
  });

  describe('parsing toFilters with url containing one filter as string', () => {
    it('then url params should be correct', () => {
      const url: UrlQueryValue = 'a-key|=|a-value';
      const a = createFilter('a', '=');
      const expected: AdHocVariableFilter[] = [a];

      expect(toFilters(url)).toEqual(expected);
    });
  });

  describe('parsing toFilters with url containing filters', () => {
    it('then url params should be correct', () => {
      const url: UrlQueryValue = ['a-key|=|a-value', 'b-key|>|b-value'];
      const a = createFilter('a', '=');
      const b = createFilter('b', '>');
      const expected: AdHocVariableFilter[] = [a, b];

      expect(toFilters(url)).toEqual(expected);
    });
  });

  describe('parsing toFilters with url containing special chars', () => {
    it('then url params should be correct', () => {
      const url: UrlQueryValue = ['a__gfp__-key|=|a__gfp__-value', 'b-key|>|b-value'];
      const a = createFilter('a|', '=');
      const b = createFilter('b', '>');
      const expected: AdHocVariableFilter[] = [a, b];

      expect(toFilters(url)).toEqual(expected);
    });
  });

  describe('parsing toFilters with url containing filter with empty values', () => {
    it('then url params should be correct', () => {
      const url: UrlQueryValue = 'key||';
      const expected: AdHocVariableFilter[] = [
        {
          value: '',
          key: 'key',
          operator: '',
          condition: '',
        },
      ];

      expect(toFilters(url)).toEqual(expected);
    });
  });

  describe('parsing toFilters with url containing no filters as string', () => {
    it('then url params should be correct', () => {
      const url: UrlQueryValue = '';
      const expected: AdHocVariableFilter[] = [];
      expect(toFilters(url)).toEqual(expected);
    });
  });
});

function createFilter(value: string, operator = '='): AdHocVariableFilter {
  return {
    value: `${value}-value`,
    key: `${value}-key`,
    operator: operator,
    condition: '',
  };
}
