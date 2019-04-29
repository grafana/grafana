import { Field, SeriesData } from '../../types/data';
import { SeriesDataMatcherID } from './ids';
import { SeriesDataMatcher, SeriesDataMatcherConfig, seriesDataMatches, seriesDataMatchers } from './matchers';

export const anyMatcher: SeriesDataMatcher<SeriesDataMatcherConfig[]> = {
  id: SeriesDataMatcherID.anyMatch,
  name: 'Any',
  description: 'Any child matches (OR)',
  excludeFromPicker: true,
  defaultOptions: [], // empty array

  matches: (options: SeriesDataMatcherConfig[], series: SeriesData, field?: Field) => {
    for (const sub of options) {
      if (seriesDataMatches(sub, series, field)) {
        return true;
      }
    }
    return false;
  },

  getOptionsDisplayText: (options: SeriesDataMatcherConfig[]) => {
    let text = '';
    for (const sub of options) {
      if (text.length > 0) {
        text += ' OR ';
      }
      const matcher = seriesDataMatchers.get(sub.id);
      text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
    }
    return text;
  },
};

export const allMatcher: SeriesDataMatcher<SeriesDataMatcherConfig[]> = {
  id: SeriesDataMatcherID.allMatch,
  name: 'All',
  description: 'Everything matches (AND)',
  excludeFromPicker: true,
  defaultOptions: [], // empty array

  matches: (options: SeriesDataMatcherConfig[], series: SeriesData, field?: Field) => {
    for (const sub of options) {
      if (!seriesDataMatches(sub, series, field)) {
        return false;
      }
    }
    return true;
  },

  getOptionsDisplayText: (options: SeriesDataMatcherConfig[]) => {
    let text = '';
    for (const sub of options) {
      if (text.length > 0) {
        text += ' AND ';
      }
      const matcher = seriesDataMatchers.get(sub.id);
      text += matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(sub) : matcher.name;
    }
    return text;
  },
};

export const notMatcher: SeriesDataMatcher<SeriesDataMatcherConfig> = {
  id: SeriesDataMatcherID.invertMatch,
  name: 'NOT',
  description: 'Inverts other matchers',
  excludeFromPicker: true,

  matches: (options: SeriesDataMatcherConfig, series: SeriesData, field?: Field) => {
    return !seriesDataMatches(options, series, field);
  },

  getOptionsDisplayText: (options: SeriesDataMatcherConfig) => {
    const matcher = seriesDataMatchers.get(options.id);
    const text = matcher.getOptionsDisplayText ? matcher.getOptionsDisplayText(options.options) : matcher.name;
    return 'NOT ' + text;
  },
};

export const alwaysSeriesMatcher = {
  id: SeriesDataMatcherID.alwaysMatch,
  name: 'All Fields',
  description: 'Always Matches',

  matches: (options: SeriesDataMatcherConfig, series: SeriesData, field?: Field) => {
    return true;
  },

  getOptionsDisplayText: (options: SeriesDataMatcherConfig) => {
    return 'Always';
  },
};

export const neverSeriesMatcher = {
  id: SeriesDataMatcherID.neverMatch,
  name: 'Never',
  description: 'Never Match',
  excludeFromPicker: true,

  matches: (options: SeriesDataMatcherConfig, series: SeriesData, field?: Field) => {
    return true;
  },

  getOptionsDisplayText: (options: SeriesDataMatcherConfig) => {
    return 'Never';
  },
};

/**
 * Registry Initalization
 */
export function getPredicateMatchers(): SeriesDataMatcher[] {
  return [anyMatcher, allMatcher, notMatcher, alwaysSeriesMatcher, neverSeriesMatcher];
}
