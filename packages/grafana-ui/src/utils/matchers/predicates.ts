import { Field, SeriesData } from '../../types/data';
import { SeriesMatcherID } from './ids';
import { SeriesMatcherConfig, seriesMatchers, getSeriesMatcher, SeriesMatcherInfo } from './matchers';

const anyMatcher: SeriesMatcherInfo<SeriesMatcherConfig[]> = {
  id: SeriesMatcherID.anyMatch,
  name: 'Any',
  description: 'Any child matches (OR)',
  excludeFromPicker: true,
  defaultOptions: [], // empty array

  matcher: (options: SeriesMatcherConfig[]) => {
    const children = options.map(option => {
      return getSeriesMatcher(option);
    });
    return (series: SeriesData, field?: Field) => {
      for (const child of children) {
        if (child(series, field)) {
          return true;
        }
      }
      return false;
    };
  },

  getOptionsDisplayText: (options: SeriesMatcherConfig[]) => {
    let text = '';
    for (const sub of options) {
      if (text.length > 0) {
        text += ' OR ';
      }
      const matcher = seriesMatchers.get(sub.id);
      text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
    }
    return text;
  },
};

const allMatcher: SeriesMatcherInfo<SeriesMatcherConfig[]> = {
  id: SeriesMatcherID.allMatch,
  name: 'All',
  description: 'Everything matches (AND)',
  excludeFromPicker: true,
  defaultOptions: [], // empty array

  matcher: (options: SeriesMatcherConfig[]) => {
    const children = options.map(option => {
      return getSeriesMatcher(option);
    });
    return (series: SeriesData, field?: Field) => {
      for (const child of children) {
        if (!child(series, field)) {
          return false;
        }
      }
      return true;
    };
  },

  getOptionsDisplayText: (options: SeriesMatcherConfig[]) => {
    let text = '';
    for (const sub of options) {
      if (text.length > 0) {
        text += ' AND ';
      }
      const matcher = seriesMatchers.get(sub.id);
      text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
    }
    return text;
  },
};

const notMatcher: SeriesMatcherInfo<SeriesMatcherConfig> = {
  id: SeriesMatcherID.invertMatch,
  name: 'NOT',
  description: 'Inverts other matchers',
  excludeFromPicker: true,

  matcher: (option: SeriesMatcherConfig) => {
    const check = getSeriesMatcher(option);
    return (series: SeriesData, field?: Field) => {
      return !check;
    };
  },

  getOptionsDisplayText: (options: SeriesMatcherConfig) => {
    const matcher = seriesMatchers.get(options.id);
    const text = matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(options.options) : matcher.name;
    return 'NOT ' + text;
  },
};

export const alwaysSeriesMatcher = (series: SeriesData, field?: Field) => {
  return true;
};

const alwaysMatcher = {
  id: SeriesMatcherID.alwaysMatch,
  name: 'All Fields',
  description: 'Always Matches',

  matcher: (option: any) => {
    return alwaysSeriesMatcher;
  },

  getOptionsDisplayText: (options: SeriesMatcherConfig) => {
    return 'Always';
  },
};

const neverSeriesMatcher = {
  id: SeriesMatcherID.neverMatch,
  name: 'Never',
  description: 'Never Match',
  excludeFromPicker: true,

  matcher: (option: any) => {
    return (series: SeriesData, field?: Field) => {
      return false;
    };
  },

  getOptionsDisplayText: (options: SeriesMatcherConfig) => {
    return 'Never';
  },
};

/**
 * Registry Initalization
 */
export function getPredicateMatchers(): SeriesMatcherInfo[] {
  return [anyMatcher, allMatcher, notMatcher, alwaysMatcher, neverSeriesMatcher];
}
