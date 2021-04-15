import { DataSourceInstanceSettings } from '@grafana/data';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { fetchRulerRulesIfNotFetchedYet } from '../state/actions';
import { getAllDataSources } from '../utils/config';
import { DataSourceType, getRulesDataSources } from '../utils/datasource';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

export function useRulesSourcesWithRuler(): DataSourceInstanceSettings[] {
  const rulerRequests = useUnifiedAlertingSelector((state) => state.rulerRules);
  const dispatch = useDispatch();

  // try fetching rules for each prometheus to see if it has ruler
  useEffect(() => {
    getAllDataSources()
      .filter((ds) => ds.type === DataSourceType.Prometheus)
      .forEach((ds) => dispatch(fetchRulerRulesIfNotFetchedYet(ds.name)));
  }, [dispatch]);

  return useMemo(
    () => getRulesDataSources().filter((ds) => ds.type === DataSourceType.Loki || !!rulerRequests[ds.name]?.result),
    [rulerRequests]
  );
}
