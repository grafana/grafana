import { type DataTransformerConfig, type FrameMatcher, getFrameMatchers } from '@grafana/data';

/**
 * The matcher for a transformation's frame filter, or nothing if that filter cannot be built into
 * one.
 *
 * `getFrameMatchers` throws on a matcher id it does not know, and `byName` runs its option through
 * `stringToJsRegex`, which throws on a `/`-prefixed string that is not a complete `/pattern/flags` —
 * a variable resolving to a path is enough. The pipeline's own call sits behind the replay's error
 * handling; callers here run during render, where a throw would take the editor down with it, so a
 * filter that cannot be built leaves the frames unnarrowed instead.
 *
 * Pass the config as the replay ran it, not the one Scene state holds: a `$var` in the filter
 * resolves before `transformDataFrame` sees it, so matching on the literal would narrow to nothing.
 */
export function frameMatcherFor(config: DataTransformerConfig | undefined): FrameMatcher | undefined {
  if (!config?.filter?.options) {
    return undefined;
  }

  try {
    return getFrameMatchers(config.filter);
  } catch (err) {
    console.error('Failed to build a transformation filter for the panel editor', err);
    return undefined;
  }
}
