import { Field, DataFrame } from '../../types/data';
import { DataMatcherID } from './ids';
import { DataMatcherConfig, dataMatchers, getDataMatcher, DataMatcherInfo } from './matchers';

const anyMatcher: DataMatcherInfo<DataMatcherConfig[]> = {
  id: DataMatcherID.anyMatch,
  name: 'Any',
  description: 'Any child matches (OR)',
  excludeFromPicker: true,
  defaultOptions: [], // empty array

  matcher: (options: DataMatcherConfig[]) => {
    const children = options.map(option => {
      return getDataMatcher(option);
    });
    return (series: DataFrame, field?: Field) => {
      for (const child of children) {
        if (child(series, field)) {
          return true;
        }
      }
      return false;
    };
  },

  getOptionsDisplayText: (options: DataMatcherConfig[]) => {
    let text = '';
    for (const sub of options) {
      if (text.length > 0) {
        text += ' OR ';
      }
      const matcher = dataMatchers.get(sub.id);
      text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
    }
    return text;
  },
};

const allMatcher: DataMatcherInfo<DataMatcherConfig[]> = {
  id: DataMatcherID.allMatch,
  name: 'All',
  description: 'Everything matches (AND)',
  excludeFromPicker: true,
  defaultOptions: [], // empty array

  matcher: (options: DataMatcherConfig[]) => {
    const children = options.map(option => {
      return getDataMatcher(option);
    });
    return (data: DataFrame, field?: Field) => {
      for (const child of children) {
        if (!child(data, field)) {
          return false;
        }
      }
      return true;
    };
  },

  getOptionsDisplayText: (options: DataMatcherConfig[]) => {
    let text = '';
    for (const sub of options) {
      if (text.length > 0) {
        text += ' AND ';
      }
      const matcher = dataMatchers.get(sub.id);
      text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
    }
    return text;
  },
};

const notMatcher: DataMatcherInfo<DataMatcherConfig> = {
  id: DataMatcherID.invertMatch,
  name: 'NOT',
  description: 'Inverts other matchers',
  excludeFromPicker: true,

  matcher: (option: DataMatcherConfig) => {
    const check = getDataMatcher(option);
    return (series: DataFrame, field?: Field) => {
      return !check;
    };
  },

  getOptionsDisplayText: (options: DataMatcherConfig) => {
    const matcher = dataMatchers.get(options.id);
    const text = matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(options.options) : matcher.name;
    return 'NOT ' + text;
  },
};

export const alwaysDataMatcher = (series: DataFrame, field?: Field) => {
  return true;
};

const alwaysMatcher = {
  id: DataMatcherID.alwaysMatch,
  name: 'All Fields',
  description: 'Always Matches',

  matcher: (option: any) => {
    return alwaysDataMatcher;
  },

  getOptionsDisplayText: (options: DataMatcherConfig) => {
    return 'Always';
  },
};

const neverDataMatcher = {
  id: DataMatcherID.neverMatch,
  name: 'Never',
  description: 'Never Match',
  excludeFromPicker: true,

  matcher: (option: any) => {
    return (series: DataFrame, field?: Field) => {
      return false;
    };
  },

  getOptionsDisplayText: (options: DataMatcherConfig) => {
    return 'Never';
  },
};

/**
 * Registry Initalization
 */
export function getPredicateMatchers(): DataMatcherInfo[] {
  return [anyMatcher, allMatcher, notMatcher, alwaysMatcher, neverDataMatcher];
}
