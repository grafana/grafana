import { Field, SeriesData } from '../../types/data';
import { ExtensionRegistry, Extension } from '../extensions';

// A list of some (but not all) matcher IDs
export enum SeriesDataMatcherID {
  // Field Type
  numericFields = 'numericFields',
  timeFields = 'timeFields',
  fieldType = 'fieldType',

  // builtin predicates
  any = '_any',
  all = '_all',
  not = '_not',
  always = '_allways',
  never = '_never',
}

/**
 * A configurable way to say if somthing should apply to a field or series
 */
export interface SeriesDataMatcher<TOptions = any> extends Extension<TOptions> {
  /**
   * When field is undefined, we are asking if the series matches
   */
  matches: (options: TOptions, series: SeriesData, field?: Field) => boolean;
}

export interface SeriesDataMatcherConfig<TOptions = any> {
  id: string;
  options?: TOptions;
}

export function seriesDataMatches(config: SeriesDataMatcherConfig, series: SeriesData, field?: Field): boolean {
  const matcher = seriesDataMatchers.get(config.id);
  if (!matcher) {
    throw new Error('Unknown Matcher: ' + config.id);
  }
  return matcher.matches(config.options, series, field);
}

export const seriesDataMatchers = new ExtensionRegistry<SeriesDataMatcher>();

import './predicates';
import './fieldType';
