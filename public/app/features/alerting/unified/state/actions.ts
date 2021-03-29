import { createAsyncThunk } from '@reduxjs/toolkit';
import { RuleNamespace } from 'app/types/unified-alerting';
import { fetchRules } from '../api/prometheus';
import { withSerializedError } from '../utils/redux';

/*
 * Will need to be updated to:
 *
 * 1. Fetch grafana managed rules when the endpoint becomes available
 * 2. Reconcile with rules from the ruler where ruler is available
 */

export const fetchRulesAction = createAsyncThunk(
  'unifiedalerting/fetchRules',
  (dataSourceName: string): Promise<RuleNamespace[]> => withSerializedError(fetchRules(dataSourceName))
);
