import { Field, SeriesData } from '../../types/data';
import { ExtensionRegistry, Extension } from '../extensions';

export type SeriesMatcher = (series: SeriesData, field?: Field) => boolean;

/**
 * A configurable way to say if somthing should apply to a field or series
 */
export interface SeriesMatcherInfo<TOptions = any> extends Extension<TOptions> {
  /**
   * When field is undefined, we are asking if the series matches
   */
  matcher: (options: TOptions) => SeriesMatcher;
}

export interface SeriesMatcherConfig<TOptions = any> {
  id: string;
  options?: TOptions;
}

export function getSeriesMatcher(config: SeriesMatcherConfig): SeriesMatcher {
  const info = seriesMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown Matcher: ' + config.id);
  }
  return info.matcher(config.options);
}

// Load the Buildtin matchers
import { getPredicateMatchers } from './predicates';
import { getFieldTypeMatchers } from './typeMatcher';
import { getNameMatchers } from './nameMatcher';

export const seriesMatchers = new ExtensionRegistry<SeriesMatcherInfo>(() => {
  return [
    ...getPredicateMatchers(), // Predicates
    ...getFieldTypeMatchers(), // field types
    ...getNameMatchers(), // By Name
  ];
});
