import { assignModelProperties } from '../types';
import { ScopedVars } from '@grafana/data';
import { containsSearchFilter, containsVariable, getSearchFilterScopedVar, SEARCH_FILTER_VARIABLE } from '../utils';

describe('containsVariable', () => {
  describe('when checking if a string contains a variable', () => {
    it('should find it with $const syntax', () => {
      const contains = containsVariable('this.$test.filters', 'test');
      expect(contains).toBe(true);
    });

    it('should not find it if only part matches with $const syntax', () => {
      const contains = containsVariable('this.$serverDomain.filters', 'server');
      expect(contains).toBe(false);
    });

    it('should find it if it ends with variable and passing multiple test strings', () => {
      const contains = containsVariable('show field keys from $pgmetric', 'test string2', 'pgmetric');
      expect(contains).toBe(true);
    });

    it('should find it with [[var]] syntax', () => {
      const contains = containsVariable('this.[[test]].filters', 'test');
      expect(contains).toBe(true);
    });

    it('should find it with [[var:option]] syntax', () => {
      const contains = containsVariable('this.[[test:csv]].filters', 'test');
      expect(contains).toBe(true);
    });

    it('should find it when part of segment', () => {
      const contains = containsVariable('metrics.$env.$group-*', 'group');
      expect(contains).toBe(true);
    });

    it('should find it its the only thing', () => {
      const contains = containsVariable('$env', 'env');
      expect(contains).toBe(true);
    });

    it('should be able to pass in multiple test strings', () => {
      const contains = containsVariable('asd', 'asd2.$env', 'env');
      expect(contains).toBe(true);
    });

    it('should find it with ${var} syntax', () => {
      const contains = containsVariable('this.${test}.filters', 'test');
      expect(contains).toBe(true);
    });

    it('should find it with ${var:option} syntax', () => {
      const contains = containsVariable('this.${test:csv}.filters', 'test');
      expect(contains).toBe(true);
    });
  });
});

describe('assignModelProperties', () => {
  it('only set properties defined in defaults', () => {
    const target: any = { test: 'asd' };
    assignModelProperties(target, { propA: 1, propB: 2 }, { propB: 0 });
    expect(target.propB).toBe(2);
    expect(target.test).toBe('asd');
  });

  it('use default value if not found on source', () => {
    const target: any = { test: 'asd' };
    assignModelProperties(target, { propA: 1, propB: 2 }, { propC: 10 });
    expect(target.propC).toBe(10);
  });
});

describe('containsSearchFilter', () => {
  describe('when called without query', () => {
    it('then it should return false', () => {
      const result = containsSearchFilter(null);

      expect(result).toBe(false);
    });
  });

  describe('when called with an object', () => {
    it('then it should return false', () => {
      const result = containsSearchFilter({});

      expect(result).toBe(false);
    });
  });

  describe(`when called with a query without ${SEARCH_FILTER_VARIABLE}`, () => {
    it('then it should return false', () => {
      const result = containsSearchFilter('$app.*');

      expect(result).toBe(false);
    });
  });

  describe(`when called with a query with $${SEARCH_FILTER_VARIABLE}`, () => {
    it('then it should return true', () => {
      const result = containsSearchFilter(`$app.$${SEARCH_FILTER_VARIABLE}`);

      expect(result).toBe(true);
    });
  });

  describe(`when called with a query with [[${SEARCH_FILTER_VARIABLE}]]`, () => {
    it('then it should return true', () => {
      const result = containsSearchFilter(`$app.[[${SEARCH_FILTER_VARIABLE}]]`);

      expect(result).toBe(true);
    });
  });

  describe(`when called with a query with \$\{${SEARCH_FILTER_VARIABLE}:regex\}`, () => {
    it('then it should return true', () => {
      const result = containsSearchFilter(`$app.\$\{${SEARCH_FILTER_VARIABLE}:regex\}`);

      expect(result).toBe(true);
    });
  });
});

interface GetSearchFilterScopedVarScenario {
  query: string;
  wildcardChar: string;
  options: { searchFilter?: string };
  expected: ScopedVars;
}

const scenarios: GetSearchFilterScopedVarScenario[] = [
  // testing the $__searchFilter notation
  {
    query: 'abc.$__searchFilter',
    wildcardChar: '',
    options: { searchFilter: '' },
    expected: { __searchFilter: { value: '', text: '' } },
  },
  {
    query: 'abc.$__searchFilter',
    wildcardChar: '*',
    options: { searchFilter: '' },
    expected: { __searchFilter: { value: '*', text: '' } },
  },
  {
    query: 'abc.$__searchFilter',
    wildcardChar: '',
    options: { searchFilter: 'a' },
    expected: { __searchFilter: { value: 'a', text: '' } },
  },
  {
    query: 'abc.$__searchFilter',
    wildcardChar: '*',
    options: { searchFilter: 'a' },
    expected: { __searchFilter: { value: 'a*', text: '' } },
  },
  // testing the [[__searchFilter]] notation
  {
    query: 'abc.[[__searchFilter]]',
    wildcardChar: '',
    options: { searchFilter: '' },
    expected: { __searchFilter: { value: '', text: '' } },
  },
  {
    query: 'abc.[[__searchFilter]]',
    wildcardChar: '*',
    options: { searchFilter: '' },
    expected: { __searchFilter: { value: '*', text: '' } },
  },
  {
    query: 'abc.[[__searchFilter]]',
    wildcardChar: '',
    options: { searchFilter: 'a' },
    expected: { __searchFilter: { value: 'a', text: '' } },
  },
  {
    query: 'abc.[[__searchFilter]]',
    wildcardChar: '*',
    options: { searchFilter: 'a' },
    expected: { __searchFilter: { value: 'a*', text: '' } },
  },
  // testing the ${__searchFilter:fmt} notation
  {
    query: 'abc.${__searchFilter:regex}',
    wildcardChar: '',
    options: { searchFilter: '' },
    expected: { __searchFilter: { value: '', text: '' } },
  },
  {
    query: 'abc.${__searchFilter:regex}',
    wildcardChar: '*',
    options: { searchFilter: '' },
    expected: { __searchFilter: { value: '*', text: '' } },
  },
  {
    query: 'abc.${__searchFilter:regex}',
    wildcardChar: '',
    options: { searchFilter: 'a' },
    expected: { __searchFilter: { value: 'a', text: '' } },
  },
  {
    query: 'abc.${__searchFilter:regex}',
    wildcardChar: '*',
    options: { searchFilter: 'a' },
    expected: { __searchFilter: { value: 'a*', text: '' } },
  },
  // testing the no options
  {
    query: 'abc.$__searchFilter',
    wildcardChar: '',
    options: null as any,
    expected: { __searchFilter: { value: '', text: '' } },
  },
  {
    query: 'abc.$__searchFilter',
    wildcardChar: '*',
    options: null as any,
    expected: { __searchFilter: { value: '*', text: '' } },
  },
  // testing the no search filter at all
  {
    query: 'abc.$def',
    wildcardChar: '',
    options: { searchFilter: '' },
    expected: {},
  },
  {
    query: 'abc.$def',
    wildcardChar: '*',
    options: { searchFilter: '' },
    expected: {},
  },
  {
    query: 'abc.$def',
    wildcardChar: '',
    options: { searchFilter: 'a' },
    expected: {},
  },
  {
    query: 'abc.$def',
    wildcardChar: '*',
    options: { searchFilter: 'a' },
    expected: {},
  },
];

scenarios.map(scenario => {
  describe('getSearchFilterScopedVar', () => {
    describe(`when called with query:'${scenario.query}'`, () => {
      describe(`and wildcardChar:'${scenario.wildcardChar}'`, () => {
        describe(`and options:'${JSON.stringify(scenario.options, null, 0)}'`, () => {
          it(`then the result should be ${JSON.stringify(scenario.expected, null, 0)}`, () => {
            const { expected, ...args } = scenario;

            expect(getSearchFilterScopedVar(args)).toEqual(expected);
          });
        });
      });
    });
  });
});
