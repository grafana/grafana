import type { JSX } from 'react';

import { type PanelData } from '@grafana/data';

import { VizWrapper } from '../rule-editor/VizWrapper';
import { type ThresholdDefinition } from '../rule-editor/util';

interface RuleViewerVisualizationProps {
  data?: PanelData;
  thresholds?: ThresholdDefinition;
}

export function RuleViewerVisualization({ data, thresholds }: RuleViewerVisualizationProps): JSX.Element | null {
  if (!data) {
    return null;
  }

  return <VizWrapper data={data} thresholds={thresholds?.config} thresholdsType={thresholds?.mode} />;
}
