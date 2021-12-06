import React, { useState } from 'react';
import { PromQueryEditorProps } from '../../components/types';
import { promQueryModeller } from '../PromQueryModeller';
import { QueryEditorMode } from '../shared/types';
import { getDefaultTestQuery, PromVisualQuery } from '../types';
import { PromQueryBuilderInner } from './PromQueryBuilderInner';

export interface State {
  viewModel: PromVisualQuery;
}

export const PromQueryBuilder = React.memo<PromQueryEditorProps>(({ datasource, query, onChange }) => {
  const [state, setState] = useState<State>({
    viewModel: getDefaultTestQuery(),
  });

  const onChangeViewModel = (updatedQuery: PromVisualQuery) => {
    setState({ ...state, viewModel: updatedQuery });

    // Update text expr
    onChange({
      ...query,
      expr: promQueryModeller.renderQuery(updatedQuery),
      editorMode: QueryEditorMode.Builder,
    });
  };

  return <PromQueryBuilderInner query={state.viewModel} datasource={datasource} onChange={onChangeViewModel} />;
});

PromQueryBuilder.displayName = 'PromQueryBuilder';
