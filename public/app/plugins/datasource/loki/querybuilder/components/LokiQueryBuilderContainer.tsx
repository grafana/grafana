import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { useEffect, useReducer } from 'react';

import { type TimeRange } from '@grafana/data';

import { testIds } from '../../components/LokiQueryEditor';
import { type LokiDatasource } from '../../datasource';
import { type LokiDisabledOperation, type LokiQuery } from '../../types';
import { lokiQueryModeller } from '../LokiQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { type LokiVisualQuery } from '../types';

import { LokiQueryBuilder } from './LokiQueryBuilder';
import { QueryPreview } from './QueryPreview';

export interface Props {
  query: LokiQuery;
  datasource: LokiDatasource;
  onChange: (update: LokiQuery) => void;
  onRunQuery: () => void;
  showExplain: boolean;
  timeRange?: TimeRange;
}

interface State {
  visQuery?: LokiVisualQuery;
  expr: string;
}

/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 */
export function LokiQueryBuilderContainer(props: Props) {
  const { query, onChange, onRunQuery, datasource, showExplain, timeRange } = props;
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
    dispatch(exprChanged({ expr: query.expr, disabledOperations: query.disabledOperations }));
  }, [query.expr, query.disabledOperations]);

  const onVisQueryChange = (visQuery: LokiVisualQuery) => {
    const expr = lokiQueryModeller.renderQuery(visQuery);
    const disabledOperations = getDisabledOperations(visQuery);
    dispatch(visualQueryChange({ visQuery, expr }));
    onChange({ ...props.query, expr, disabledOperations: disabledOperations.length ? disabledOperations : undefined });
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
        timeRange={timeRange}
      />
      {query.expr !== '' && <QueryPreview query={query.expr} />}
    </>
  );
}

const initialState: State = { expr: '' };

function getDisabledOperations(visQuery: LokiVisualQuery): LokiDisabledOperation[] {
  return visQuery.operations
    .map((operation, index) => ({ index, operation }))
    .filter(({ operation }) => operation.disabled);
}

function applyDisabledOperations(
  visQuery: LokiVisualQuery,
  disabledOperations?: LokiDisabledOperation[]
): LokiVisualQuery {
  if (!disabledOperations?.length) {
    return visQuery;
  }
  const operations = [...visQuery.operations];
  for (const { index, operation } of [...disabledOperations].sort((a, b) => a.index - b.index)) {
    operations.splice(index, 0, operation);
  }
  return { ...visQuery, operations };
}

const stateSlice = createSlice({
  name: 'loki-builder-container',
  initialState,
  reducers: {
    visualQueryChange: (state, action: PayloadAction<{ visQuery: LokiVisualQuery; expr: string }>) => {
      state.expr = action.payload.expr;
      state.visQuery = action.payload.visQuery;
    },
    exprChanged: (
      state,
      action: PayloadAction<{ expr: string; disabledOperations?: LokiDisabledOperation[] }>
    ) => {
      if (!state.visQuery || state.expr !== action.payload.expr) {
        state.expr = action.payload.expr;
        const parseResult = buildVisualQueryFromString(action.payload.expr);
        state.visQuery = applyDisabledOperations(parseResult.query, action.payload.disabledOperations);
      }
    },
  },
});

const { visualQueryChange, exprChanged } = stateSlice.actions;
