import { Field, SeriesData } from '../../types/data';
import { ExtensionRegistry, Extension } from '../extensions';

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

// Load the Buildtin matchers
import { getPredicateMatchers } from './predicates';
import { getFieldTypeMatchers } from './fieldType';

export const seriesDataMatchers = new ExtensionRegistry<SeriesDataMatcher>(() => {
  const matchers: SeriesDataMatcher[] = [
    ...getPredicateMatchers(), // Predicates
    ...getFieldTypeMatchers(), // field types
  ];
  return matchers;
});
