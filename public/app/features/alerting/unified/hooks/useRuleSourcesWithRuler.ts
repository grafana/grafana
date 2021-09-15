import { DataSourceInstanceSettings } from '@grafana/data';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { checkIfLotexSupportsEditingRulesAction } from '../state/actions';
import { getRulesDataSources } from '../utils/datasource';
import { useUnifiedAlertingSelector } from './useUnifiedAlertingSelector';

export function useRulesSourcesWithRuler(): DataSourceInstanceSettings[] {
  const checkEditingRequests = useUnifiedAlertingSelector((state) => state.lotexSupportsRuleEditing);
  const dispatch = useDispatch();

  // try fetching rules for each prometheus to see if it has ruler
  useEffect(() => {
    getRulesDataSources()
      .filter((ds) => checkEditingRequests[ds.name] === undefined)
      .forEach((ds) => dispatch(checkIfLotexSupportsEditingRulesAction(ds.name)));
  }, [dispatch, checkEditingRequests]);

  return useMemo(() => getRulesDataSources().filter((ds) => checkEditingRequests[ds.name]?.result), [
    checkEditingRequests,
  ]);
}
