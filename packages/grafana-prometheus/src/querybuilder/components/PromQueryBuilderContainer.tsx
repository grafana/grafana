// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/querybuilder/components/PromQueryBuilderContainer.tsx
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { useEffect, useReducer } from 'react';

import { PanelData } from '@grafana/data';

import { PrometheusDatasource } from '../../datasource';
import { PromQuery } from '../../types';
import { buildVisualQueryFromString } from '../parsing';
import { promQueryModeller } from '../shared/modeller_instance';
import { PromVisualQuery } from '../types';

import { PromQueryBuilder } from './PromQueryBuilder';
import { QueryPreview } from './QueryPreview';
import { getSettings, MetricsModalSettings } from './metrics-modal/state/state';

interface PromQueryBuilderContainerProps {
  query: PromQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showExplain: boolean;
}

interface State {
  visQuery?: PromVisualQuery;
  expr: string;
}

/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 */
export function PromQueryBuilderContainer(props: PromQueryBuilderContainerProps) {
  const { query, onChange, onRunQuery, datasource, data, showExplain } = props;
  const [state, dispatch] = useReducer(stateSlice.reducer, { expr: query.expr });
  // Only rebuild visual query if expr changes from outside
  useEffect(() => {
    dispatch(exprChanged(query.expr));
    dispatch(
      setMetricsModalSettings({
        useBackend: query.useBackend ?? false,
        disableTextWrap: query.disableTextWrap ?? false,
        fullMetaSearch: query.fullMetaSearch ?? false,
        includeNullMetadata: query.includeNullMetadata ?? true,
      })
    );
  }, [query]);

  useEffect(() => {
    datasource.languageProvider.start(data?.timeRange);
  }, [data?.timeRange, datasource.languageProvider]);

  const onVisQueryChange = (visQuery: PromVisualQuery) => {
    const expr = promQueryModeller.renderQuery(visQuery);
    dispatch(visualQueryChange({ visQuery, expr }));

    const metricsModalSettings = getSettings(visQuery);
    onChange({ ...props.query, expr: expr, ...metricsModalSettings });
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
      {<QueryPreview query={query.expr} />}
    </>
  );
}

const initialState: State = {
  expr: '',
};

const stateSlice = createSlice({
  name: 'prom-builder-container',
  initialState,
  reducers: {
    visualQueryChange: (state, action: PayloadAction<{ visQuery: PromVisualQuery; expr: string }>) => {
      state.expr = action.payload.expr;
      state.visQuery = action.payload.visQuery;
    },
    exprChanged: (state, action: PayloadAction<string>) => {
      if (!state.visQuery || state.expr !== action.payload) {
        state.expr = action.payload;
        const parseResult = buildVisualQueryFromString(action.payload ?? '');

        state.visQuery = parseResult.query;
      }
    },
    setMetricsModalSettings: (state, action: PayloadAction<MetricsModalSettings>) => {
      if (state.visQuery) {
        state.visQuery.useBackend = action.payload.useBackend;
        state.visQuery.disableTextWrap = action.payload.disableTextWrap;
        state.visQuery.fullMetaSearch = action.payload.fullMetaSearch;
        state.visQuery.includeNullMetadata = action.payload.includeNullMetadata;
      }
    },
  },
});

const { visualQueryChange, exprChanged, setMetricsModalSettings } = stateSlice.actions;
