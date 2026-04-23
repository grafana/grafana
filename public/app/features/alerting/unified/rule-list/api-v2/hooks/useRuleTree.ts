import { useCallback, useMemo, useReducer } from 'react';

import { type RuleNamespace } from 'app/types/unified-alerting';

import { alertRuleApi } from '../../../api/alertRuleApi';
import { useRulesFilter } from '../../../hooks/useFilteredRules';
import { GRAFANA_RULES_SOURCE_NAME, getRulesDataSources } from '../../../utils/datasource';
import { applyRulesFilterToTree } from '../lib/applyRulesFilterToTree';
import { type DataSourceInput, buildTreeModel } from '../lib/treeModel';
import { type TreeModel } from '../lib/types';

const POLL_INTERVAL_MS = 120_000;

export interface ExternalSourceResult {
  namespaces?: RuleNamespace[];
  error?: string;
}

export interface UseRuleTreeResult {
  filteredTree: TreeModel;
  preStateTree: TreeModel;
  isLoading: boolean;
  externalDataSources: Array<{ uid: string; name: string }>;
  publishExternalResult: (uid: string, result: ExternalSourceResult) => void;
}

type Action = { type: 'set'; uid: string; result: ExternalSourceResult };

function reducer(state: Record<string, ExternalSourceResult>, action: Action): Record<string, ExternalSourceResult> {
  if (action.type === 'set') {
    const prev = state[action.uid];
    if (prev && prev.namespaces === action.result.namespaces && prev.error === action.result.error) {
      return state;
    }
    return { ...state, [action.uid]: action.result };
  }
  return state;
}

export function useRuleTree(): UseRuleTreeResult {
  const { filterState } = useRulesFilter();

  const externalDataSources = useMemo(
    () =>
      getRulesDataSources().map((ds) => ({
        uid: ds.uid,
        name: ds.name,
      })),
    []
  );

  const grafanaQuery = alertRuleApi.endpoints.prometheusRulesByNamespace.useQuery(
    { limitAlerts: 0 },
    { pollingInterval: POLL_INTERVAL_MS }
  );

  const [externalResults, dispatch] = useReducer(reducer, {});

  const publishExternalResult = useCallback((uid: string, result: ExternalSourceResult) => {
    dispatch({ type: 'set', uid, result });
  }, []);

  const rawTree = useMemo<TreeModel>(() => {
    const inputs: DataSourceInput[] = [];

    inputs.push({
      uid: GRAFANA_RULES_SOURCE_NAME,
      name: 'Grafana-managed',
      isGrafana: true,
      namespaces: grafanaQuery.data,
      error: grafanaQuery.isError ? errorMessage(grafanaQuery.error) : undefined,
    });

    for (const ds of externalDataSources) {
      const result = externalResults[ds.uid];
      inputs.push({
        uid: ds.uid,
        name: ds.name,
        isGrafana: false,
        namespaces: result?.namespaces,
        error: result?.error,
      });
    }

    return buildTreeModel(inputs);
  }, [grafanaQuery.data, grafanaQuery.isError, grafanaQuery.error, externalDataSources, externalResults]);

  const filteredTree = useMemo(() => applyRulesFilterToTree(rawTree, filterState), [rawTree, filterState]);
  const preStateTree = useMemo(
    () => applyRulesFilterToTree(rawTree, filterState, { ignoreRuleState: true }),
    [rawTree, filterState]
  );

  return {
    filteredTree,
    preStateTree,
    isLoading: grafanaQuery.isLoading,
    externalDataSources,
    publishExternalResult,
  };
}

function errorMessage(err: unknown): string {
  const status = extractStatus(err);
  if (status === 'FETCH_ERROR') {
    return 'Failed to load rules: connection refused';
  }
  if (typeof status === 'number') {
    return `Failed to load rules: ${status}`;
  }
  return 'Failed to load rules';
}

function extractStatus(err: unknown): unknown {
  if (err && typeof err === 'object' && 'status' in err) {
    return err.status;
  }
  return undefined;
}
