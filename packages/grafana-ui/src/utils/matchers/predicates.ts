import { Field, SeriesData } from '../../types/data';
import {
  SeriesDataMatcher,
  SeriesDataMatcherConfig,
  seriesDataMatches,
  seriesDataMatchers,
  SeriesDataMatcherID,
} from './matchers';

const anyMatcher: SeriesDataMatcher<SeriesDataMatcherConfig[]> = {
  id: SeriesDataMatcherID.any,
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

const allMatcher: SeriesDataMatcher<SeriesDataMatcherConfig[]> = {
  id: SeriesDataMatcherID.all,
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

const notMatcher: SeriesDataMatcher<SeriesDataMatcherConfig> = {
  id: SeriesDataMatcherID.not,
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
  id: SeriesDataMatcherID.always,
  name: 'All Fields',
  description: 'Always Matches',

  matches: (options: SeriesDataMatcherConfig, series: SeriesData, field?: Field) => {
    return true;
  },

  getOptionsDisplayText: (options: SeriesDataMatcherConfig) => {
    return 'Always';
  },
};

seriesDataMatchers.register(anyMatcher);
seriesDataMatchers.register(allMatcher);
seriesDataMatchers.register(notMatcher);

seriesDataMatchers.register(alwaysSeriesMatcher);
