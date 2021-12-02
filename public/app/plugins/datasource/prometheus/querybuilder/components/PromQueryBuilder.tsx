import React, { useState } from 'react';
import { PromQueryEditorProps } from '../../components/types';
import { MetricSelect } from './MetricSelect';
import { PromVisualQuery } from '../types';
import { LabelFilters } from './LabelFilters';
import { Operations } from './Operations';
import EditorRows from 'app/plugins/datasource/cloudwatch/components/ui/EditorRows';
import EditorRow from 'app/plugins/datasource/cloudwatch/components/ui/EditorRow';

export interface State {
  viewModel: PromVisualQuery;
}

export const PromQueryBuilder = React.memo<PromQueryEditorProps>(({ datasource }) => {
  const [state, setState] = useState<State>({
    viewModel: getDefaultTestQuery(),
  });

  const onChange = (updatedQuery: PromVisualQuery) => {
    setState({ ...state, viewModel: updatedQuery });
  };

  return (
    <EditorRows>
      <EditorRow>
        <MetricSelect query={state.viewModel} onChange={onChange} />
      </EditorRow>
      <EditorRow>
        <LabelFilters query={state.viewModel} datasource={datasource} onChange={onChange} />
      </EditorRow>
      <EditorRow>
        <Operations query={state.viewModel} onChange={onChange} />
      </EditorRow>
    </EditorRows>
  );
});

function getDefaultTestQuery() {
  const model: PromVisualQuery = {
    metric: 'cortex_query_scheduler_queue_duration_seconds_bucket',
    labels: [
      { label: 'cluster', op: '=~', value: '$cluster' },
      { label: 'job', op: '=~', value: '($namespace)/query-scheduler.*' },
    ],
    operations: [
      { id: 'rate', params: ['auto'] },
      { id: '__group_by', params: ['sum', 'job', 'cluster'] },
    ],
  };

  return model;
}

PromQueryBuilder.displayName = 'PromQueryBuilder';
