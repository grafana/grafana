import { createAsyncThunk } from '@reduxjs/toolkit';
import { RulesSourceResult } from 'app/types/unified-alerting/internal';
import { fetchRules } from '../api/rules';
import { getAllDataSources } from '../utils/config';
import { DataSourceType } from '../utils/datasource';

/*
 * Will need to be updated to:
 *
 * 1. Fetch grafana managed rules when the endpoint becomes available
 * 2. Reconcile with rules from the ruler where ruler is available
 */

export const fetchRulesAction = createAsyncThunk(
  'unifiedalerting/fetchRules',
  (): Promise<RulesSourceResult[]> =>
    Promise.all(
      getAllDataSources()
        .filter((ds) => ds.type === DataSourceType.Loki || ds.type === DataSourceType.Prometheus)
        .map((ds) =>
          fetchRules(ds.name)
            .then((namespaces) => ({ datasourceName: ds.name, namespaces }))
            .catch((error) => ({ datasourceName: ds.name, error }))
        )
    )
);
