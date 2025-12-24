import { DataFrameJSON } from '@grafana/data';
import {
  AlertQuery,
  GrafanaAlertStateDecision,
  Labels,
} from 'app/types/unified-alerting-dto';

import { alertingApi } from './alertingApi';

/**
 * Request body for the backtest API matching the BacktestConfig struct in the backend
 */
export interface BacktestRequest {
  // Required time range fields
  from: string; // ISO 8601 timestamp
  to: string; // ISO 8601 timestamp
  interval: string; // e.g., "1m", "5m"

  // Required alert definition fields
  condition: string;
  data: AlertQuery[];
  title: string;
  no_data_state?: GrafanaAlertStateDecision;
  exec_err_state?: GrafanaAlertStateDecision;

  // Optional duration fields
  for?: string;
  keep_firing_for?: string;

  // Optional metadata fields
  labels?: Labels;
  missing_series_evals_to_resolve?: number;

  // Optional rule identification fields
  uid?: string;
  rule_group?: string;
  namespace_uid?: string;
}

export const BACKTEST_URL = '/api/v1/rule/backtest';

export const backtestApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    runBacktest: build.mutation<DataFrameJSON, BacktestRequest>({
      query: (requestBody) => ({
        url: BACKTEST_URL,
        method: 'POST',
        body: requestBody,
      }),
    }),
  }),
});

export const { useRunBacktestMutation } = backtestApi;
