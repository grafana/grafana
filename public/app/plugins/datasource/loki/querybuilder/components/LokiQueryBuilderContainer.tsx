import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import React, { useEffect, useReducer } from 'react';

import { testIds } from '../../components/LokiQueryEditor';
import { LokiDatasource } from '../../datasource';
import { LokiQuery } from '../../types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { LokiVisualQuery } from '../types';

import { LokiQueryBuilder } from './LokiQueryBuilder';
import { QueryPreview } from './QueryPreview';

export interface Props {
  query: LokiQuery;
  datasource: LokiDatasource;
  onChange: (update: LokiQuery) => void;
  onRunQuery: () => void;
  showRawQuery: boolean;
  showExplain: boolean;
}

export interface State {
  visQuery?: LokiVisualQuery;
  expr: string;
}

/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 */
export function LokiQueryBuilderContainer(props: Props) {
  const { query, onChange, onRunQuery, datasource, showRawQuery, showExplain } = props;
  const [state, dispatch] = useReducer(stateSlice.reducer, {
    expr: query.expr,
    // Use initial visual query only if query.expr is empty string
    visQuery:
      query.expr === ''
        ? {
            labels: [],
            operations: [{ id: '__line_contains', params: [''] }],
          }
        : undefined,
  });

  // Only rebuild visual query if expr changes from outside
  useEffect(() => {
    dispatch(exprChanged(query.expr));
  }, [query.expr]);

  const onVisQueryChange = (visQuery: LokiVisualQuery) => {
    const expr = lokiQueryModeller.renderQuery(visQuery);
    dispatch(visualQueryChange({ visQuery, expr }));
    onChange({ ...props.query, expr: expr });
  };

  if (!state.visQuery) {
    return null;
  }

  return (
    <>
      <LokiQueryBuilder
        query={state.visQuery}
        datasource={datasource}
        onChange={onVisQueryChange}
        onRunQuery={onRunQuery}
        showExplain={showExplain}
        data-testid={testIds.editor}
      />
      {showRawQuery && <QueryPreview query={query.expr} />}
    </>
  );
}

const stateSlice = createSlice({
  name: 'loki-builder-container',
  initialState: { expr: '' } as State,
  reducers: {
    visualQueryChange: (state, action: PayloadAction<{ visQuery: LokiVisualQuery; expr: string }>) => {
      state.expr = action.payload.expr;
      state.visQuery = action.payload.visQuery;
    },
    exprChanged: (state, action: PayloadAction<string>) => {
      if (!state.visQuery || state.expr !== action.payload) {
        state.expr = action.payload;
        const parseResult = buildVisualQueryFromString(action.payload);
        state.visQuery = parseResult.query;
      }
    },
  },
});

const { visualQueryChange, exprChanged } = stateSlice.actions;
