import { GraphiteQueryEditorState } from '../state/store';
import { GraphiteSegment } from '../types';

import { MetricSegment } from './MetricSegment';

type Props = {
  segments: GraphiteSegment[];
  state: GraphiteQueryEditorState;
};

export function MetricsSection({ segments = [], state }: Props) {
  return (
    <div>
      {segments.map((segment, index) => {
        return <MetricSegment segment={segment} metricIndex={index} key={index} state={state} />;
      })}
    </div>
  );
}
