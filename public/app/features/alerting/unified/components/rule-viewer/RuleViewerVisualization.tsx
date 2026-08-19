import type { JSX } from 'react';

import { type PanelData } from '@grafana/data';

import { VizWrapper } from '../rule-editor/VizWrapper';
import { type ThresholdDefinition } from '../rule-editor/util';

import { EvalLoadingBar, NoEvalData } from './EvalStatus';

interface RuleViewerVisualizationProps {
  data?: PanelData;
  thresholds?: ThresholdDefinition;
  isLoading?: boolean;
}

export function RuleViewerVisualization({
  data,
  thresholds,
  isLoading = false,
}: RuleViewerVisualizationProps): JSX.Element {
  return (
    <>
      {isLoading && <EvalLoadingBar />}
      {data ? (
        <VizWrapper data={data} thresholds={thresholds?.config} thresholdsType={thresholds?.mode} />
      ) : (
        !isLoading && <NoEvalData />
      )}
    </>
  );
}
