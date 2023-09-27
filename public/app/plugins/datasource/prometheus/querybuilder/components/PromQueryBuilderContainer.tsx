import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import React, { useEffect, useReducer } from 'react';

import { PanelData } from '@grafana/data';
import { config } from '@grafana/runtime';

import { PrometheusDatasource } from '../../datasource';
import { PromQuery } from '../../types';
import { promQueryModeller } from '../PromQueryModeller';
import { buildVisualQueryFromString } from '../parsing';
import { PromVisualQuery } from '../types';

import { PromQueryBuilder } from './PromQueryBuilder';
import { QueryPreview } from './QueryPreview';
import { getSettings, MetricsModalSettings } from './metrics-modal/state/state';

export interface Props {
  query: PromQuery;
  datasource: PrometheusDatasource;
  onChange: (update: PromQuery) => void;
  onRunQuery: () => void;
  data?: PanelData;
  showExplain: boolean;
}

export interface State {
  visQuery?: PromVisualQuery;
  expr: string;
}

const prometheusMetricEncyclopedia = config.featureToggles.prometheusMetricEncyclopedia;
/**
 * This component is here just to contain the translation logic between string query and the visual query builder model.
 */
export function PromQueryBuilderContainer(props: Props) {
  const { query, onChange, onRunQuery, datasource, data, showExplain } = props;
  const [state, dispatch] = useReducer(stateSlice.reducer, { expr: query.expr });
  // Only rebuild visual query if expr changes from outside
  useEffect(() => {
    dispatch(exprChanged(query.expr));

    if (prometheusMetricEncyclopedia) {
      dispatch(
        setMetricsModalSettings({
          useBackend: query.useBackend ?? false,
          disableTextWrap: query.disableTextWrap ?? false,
          fullMetaSearch: query.fullMetaSearch ?? false,
          includeNullMetadata: query.includeNullMetadata ?? true,
        })
      );
    }
  }, [query]);

  const onVisQueryChange = (visQuery: PromVisualQuery) => {
    const expr = promQueryModeller.renderQuery(visQuery);
    dispatch(visualQueryChange({ visQuery, expr }));

    if (prometheusMetricEncyclopedia) {
      const metricsModalSettings = getSettings(visQuery);
      onChange({ ...props.query, expr: expr, ...metricsModalSettings });
    } else {
      onChange({ ...props.query, expr: expr });
    }
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
        const parseResult = buildVisualQueryFromString(action.payload ?? '');

        state.visQuery = parseResult.query;
      }
    },
    setMetricsModalSettings: (state, action: PayloadAction<MetricsModalSettings>) => {
      if (state.visQuery && prometheusMetricEncyclopedia) {
        state.visQuery.useBackend = action.payload.useBackend;
        state.visQuery.disableTextWrap = action.payload.disableTextWrap;
        state.visQuery.fullMetaSearch = action.payload.fullMetaSearch;
        state.visQuery.includeNullMetadata = action.payload.includeNullMetadata;
      }
    },
  },
});

const { visualQueryChange, exprChanged, setMetricsModalSettings } = stateSlice.actions;
