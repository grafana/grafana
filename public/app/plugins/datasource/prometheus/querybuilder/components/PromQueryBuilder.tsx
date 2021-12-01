import { SegmentSection } from '@grafana/ui';
import React, { useState } from 'react';
import { PromQueryEditorProps } from '../../components/types';
import { MetricSelect } from './MetricSelect';
import { PromVisualQuery } from '../types';
import { LabelFilters } from './LabelFilters';
import { Operations } from './Operations';

export interface State {
  viewModel: PromVisualQuery;
}

export const PromQueryBuilder = React.memo<PromQueryEditorProps>((props) => {
  const [state, setState] = useState<State>({
    viewModel: getDefaultTestQuery(),
  });

  const onChange = (updatedQuery: PromVisualQuery) => {
    setState({ ...state, viewModel: updatedQuery });
  };

  return (
    <div>
      <SegmentSection label="Metric" fill={true}>
        <MetricSelect query={state.viewModel} />
      </SegmentSection>
      <SegmentSection label="Labels" fill={true}>
        <LabelFilters query={state.viewModel} />
      </SegmentSection>
      <SegmentSection label="Operations" fill={true}>
        <Operations query={state.viewModel} onChange={onChange} />
      </SegmentSection>
    </div>
  );
});

function getDefaultTestQuery() {
  const model: PromVisualQuery = {
    metric: 'cortex_query_scheduler_queue_duration_seconds_bucket',
    labels: [
      { label: 'cluster', op: '=~', value: '$cluster' },
      { label: 'job', op: '=~', value: '($namespace)/query-scheduler.*' },
    ],
    operations: [{ type: 'rate', params: ['auto'] }],
  };

  return model;
}

PromQueryBuilder.displayName = 'PromQueryBuilder';
