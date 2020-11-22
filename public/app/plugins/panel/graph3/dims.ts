import { FieldMatcher, FieldMatcherID, fieldMatchers, MatcherConfig } from '@grafana/data';
import { XYFieldMatchers } from '@grafana/ui/src/components/GraphNG/GraphNG';
import { defaultXYPlotConfig, GraphOptions, GraphType } from './types';

function getMatcherFromConfig(cfg: MatcherConfig): FieldMatcher {
  const m = fieldMatchers.getIfExists(cfg.id);
  if (!m) {
    return fieldMatchers.get(FieldMatcherID.numeric).get({});
  }
  return m.get(cfg.options);
}

export function configToXYFieldMatchers(options: GraphOptions): XYFieldMatchers | undefined {
  if (options.type === GraphType.XYPlot) {
    const cfg = options.xy ?? defaultXYPlotConfig;
    return {
      x: getMatcherFromConfig(cfg.xFields ?? defaultXYPlotConfig.xFields!),
      y: getMatcherFromConfig(cfg.yFields ?? defaultXYPlotConfig.yFields!),
    };
  }
  return undefined;
}
