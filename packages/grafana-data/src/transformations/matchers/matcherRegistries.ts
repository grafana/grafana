import {
  type FieldMatcher,
  type FieldMatcherInfo,
  type FrameMatcher,
  type FrameMatcherInfo,
  type MatcherConfig,
  type ValueMatcher,
  type ValueMatcherInfo,
} from '../../types/transformations';
import { Registry } from '../../utils/Registry';

// Registries are defined here (rather than in ./matchers.ts) so that internal modules
// like ./matchers/predicates can resolve sub-matchers at runtime without creating a
// circular import back to ./matchers. ./matchers.ts owns initialization via setInit().

/** @public */
export const fieldMatchers = new Registry<FieldMatcherInfo>();
/** @public */
export const frameMatchers = new Registry<FrameMatcherInfo>();
/** @public */
export const valueMatchers = new Registry<ValueMatcherInfo>();

/** @public */
export function getFieldMatcher(config: MatcherConfig): FieldMatcher {
  const info = fieldMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown field matcher: ' + config.id);
  }
  return info.get(config.options);
}

/** @public */
export function getFrameMatchers(config: MatcherConfig): FrameMatcher {
  const info = frameMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown frame matcher: ' + config.id);
  }
  return info.get(config.options);
}

/** @public */
export function getValueMatcher(config: MatcherConfig): ValueMatcher {
  const info = valueMatchers.get(config.id);
  if (!info) {
    throw new Error('Unknown value matcher: ' + config.id);
  }
  return info.get(config.options);
}
