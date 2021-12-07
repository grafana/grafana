import { QueryEditorMode } from 'app/plugins/datasource/prometheus/querybuilder/shared/types';
import React, { useState } from 'react';
import { LokiQueryEditorProps } from '../../components/types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { getDefaultTestQuery, LokiVisualQuery } from '../types';
import { LokiQueryBuilderInner } from './LokiQueryBuilderInner';

export interface State {
  viewModel: LokiVisualQuery;
}

export const LokiQueryBuilder = React.memo<LokiQueryEditorProps>(({ datasource, query, onChange }) => {
  const [state, setState] = useState<State>({
    viewModel: getDefaultTestQuery(),
  });

  const onChangeViewModel = (updatedQuery: LokiVisualQuery) => {
    setState({ ...state, viewModel: updatedQuery });

    // Update text expr
    onChange({
      ...query,
      expr: lokiQueryModeller.renderQuery(updatedQuery),
      editorMode: QueryEditorMode.Builder,
    });
  };

  return <LokiQueryBuilderInner query={state.viewModel} datasource={datasource} onChange={onChangeViewModel} />;
});

LokiQueryBuilder.displayName = 'LokiQueryBuilder';
