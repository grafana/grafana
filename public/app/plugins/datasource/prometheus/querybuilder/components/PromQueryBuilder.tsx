import React, { useState } from 'react';
import { PromQueryEditorProps } from '../../components/types';
import { getDefaultTestQuery, PromVisualQuery } from '../types';
import { PromQueryBuilderInner } from './PromQueryBuilderInner';

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

  return <PromQueryBuilderInner query={state.viewModel} datasource={datasource} onChange={onChange} />;
});

PromQueryBuilder.displayName = 'PromQueryBuilder';
