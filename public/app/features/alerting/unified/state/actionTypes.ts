export const alertingActionTypePrefix = {
  fetchPromRules: 'unifiedalerting/fetchPromRules',
  fetchRulerRules: 'unifiedalerting/fetchRulerRules',
  fetchRulesSourceList: 'unifiedalerting/fetchRulesSourceList',
  fetchGrafanaAnnotations: 'unifiedalerting/fetchGrafanaAnnotations',
  updateAlertManagerConfig: 'unifiedalerting/updateAMConfig',
  deleteAlertManagerConfig: 'unifiedalerting/deleteAlertManagerConfig',
} as const;
