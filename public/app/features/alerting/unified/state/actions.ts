import { createAsyncThunk } from '@reduxjs/toolkit';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';
import { RuleNamespace } from 'app/types/unified-alerting';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';
import { fetchRules } from '../api/prometheus';
import { fetchAlertManagerConfig } from '../api/alertmanager';
import { fetchRulerRules } from '../api/ruler';
import { withSerializedError } from '../utils/redux';

export const fetchPromRulesAction = createAsyncThunk(
  'unifiedalerting/fetchPromRules',
  (rulesSourceName: string): Promise<RuleNamespace[]> => withSerializedError(fetchRules(rulesSourceName))
);

export const fetchAlertManagerConfigAction = createAsyncThunk(
  'unifiedalerting/fetchAmConfig',
  (alertManagerSourceName: string): Promise<AlertManagerCortexConfig> =>
    withSerializedError(fetchAlertManagerConfig(alertManagerSourceName))
);

export const fetchRulerRulesAction = createAsyncThunk(
  'unifiedalerting/fetchRulerRules',
  (rulesSourceName: string): Promise<RulerRulesConfigDTO | null> => {
    return withSerializedError(
      fetchRulerRules(rulesSourceName).catch((e) => {
        if (e.status === 500 && e.data?.message?.includes('mapping values are not allowed in this context')) {
          return;
        }
        return e;
      })
    );
  }
);
