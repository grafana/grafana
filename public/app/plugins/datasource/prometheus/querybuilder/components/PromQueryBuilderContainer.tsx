import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import React, { useEffect, useReducer } from 'react';

import { PanelData } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PromQuery } from '../../types';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { PromVisualQuery } from '../types';

import { PromQueryBuilder } from './PromQueryBuilder';
import { QueryPreview } from './QueryPreview';

export interface Props {
  query: PromQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showRawQuery?: boolean;
  showExplain: boolean;
}

export interface State {
  visQuery?: PromVisualQuery;
  expr: string;
}

/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 */
export function PromQueryBuilderContainer(props: Props) {
  const { query, onChange, onRunQuery, datasource, data, showRawQuery, showExplain } = props;
  const [state, dispatch] = useReducer(stateSlice.reducer, { expr: query.expr });

  // Only rebuild visual query if expr changes from outside
  useEffect(() => {
    dispatch(exprChanged(query.expr));
  }, [query.expr]);

  const onVisQueryChange = (visQuery: PromVisualQuery) => {
    const expr = promQueryModeller.renderQuery(visQuery);
    dispatch(visualQueryChange({ visQuery, expr }));
    onChange({ ...props.query, expr: expr });
  };

  if (!state.visQuery) {
    return null;
  }

  return (
    <>
      <PromQueryBuilder
        query={state.visQuery}
        datasource={datasource}
        onChange={onVisQueryChange}
        onRunQuery={onRunQuery}
        data={data}
        showExplain={showExplain}
      />
      {showRawQuery && <QueryPreview query={query.expr} />}
    </>
  );
}

const stateSlice = createSlice({
  name: 'prom-builder-container',
  initialState: { expr: '' } as State,
  reducers: {
    visualQueryChange: (state, action: PayloadAction<{ visQuery: PromVisualQuery; expr: string }>) => {
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
