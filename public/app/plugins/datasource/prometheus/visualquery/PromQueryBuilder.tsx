import { SegmentSection } from '@grafana/ui';
import React from 'react';
import { PromQueryEditorProps } from '../components/types';
import { MetricSelect } from './MetricSelect';
import { PromVisualQuery } from './types';

export const PromQueryBuilder = React.memo<PromQueryEditorProps>((props) => {
  const model: PromVisualQuery = {
    metric: 'cortex_query_scheduler_queue_duration_seconds_bucket',
    labels: [
      { label: 'cluster', op: '=~', value: '$cluster' },
      { label: 'job', op: '=~', value: '($namespace)/query-scheduler.*' },
    ],
    operations: [],
  };

  return (
    <div>
      <SegmentSection label="Metric" fill={true}>
        <MetricSelect query={model} />
      </SegmentSection>
      <SegmentSection label="Labels" fill={true}>
        <div />
      </SegmentSection>
      <SegmentSection label="Operations" fill={true}>
        <div />
      </SegmentSection>
    </div>
  );
});

PromQueryBuilder.displayName = 'PromQueryBuilder';
