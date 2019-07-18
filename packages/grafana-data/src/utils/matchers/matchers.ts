import { Field, DataFrame } from '../../types/data';
import { Registry, RegistryItemWithOptions } from '../registry';

export type DataMatcher = (series: DataFrame, field?: Field) => boolean;

/**
 * A configurable way to say if somthing should apply to a field or series
 */
export interface DataMatcherInfo<TOptions = any> extends RegistryItemWithOptions<TOptions> {
  /**
   * When field is undefined, we are asking if the series matches
   */
  matcher: (options: TOptions) => DataMatcher;
}

export interface DataMatcherConfig<TOptions = any> {
  id: string;
  options?: TOptions;
}

export function getDataMatcher(config: DataMatcherConfig): DataMatcher {
  const info = dataMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown Matcher: ' + config.id);
  }
  return info.matcher(config.options);
}

// Load the Buildtin matchers
import { getPredicateMatchers } from './predicates';
import { getFieldTypeMatchers } from './typeMatcher';
import { getNameMatchers } from './nameMatcher';

export const dataMatchers = new Registry<DataMatcherInfo>(() => {
  return [
    ...getPredicateMatchers(), // Predicates
    ...getFieldTypeMatchers(), // field types
    ...getNameMatchers(), // By Name
  ];
});
