import { FieldMatcher, FieldMatcherID, fieldMatchers, MatcherConfig } from '@grafana/data';
import { XYFieldMatchers } from '@grafana/ui/src/components/GraphNG/GraphNG';
import { defaultXYDimensions, GraphOptions } from './types';

function getMatcherFromConfig(cfg: MatcherConfig): FieldMatcher {
  const m = fieldMatchers.getIfExists(cfg.id);
  if (!m) {
    return fieldMatchers.get(FieldMatcherID.numeric).get({});
  }
  return m.get(cfg.options);
}

export function configToXYFieldMatchers(options: GraphOptions): XYFieldMatchers | undefined {
  const cfg = options?.dims ?? defaultXYDimensions;
  return {
    x: getMatcherFromConfig(cfg.xFields ?? defaultXYDimensions.xFields!),
    y: getMatcherFromConfig(cfg.yFields ?? defaultXYDimensions.yFields!),
  };
}
