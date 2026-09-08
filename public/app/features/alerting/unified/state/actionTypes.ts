export const alertingActionTypePrefix = {
  fetchPromRules: 'unifiedalerting/fetchPromRules',
  fetchRulerRules: 'unifiedalerting/fetchRulerRules',
  fetchGrafanaAnnotations: 'unifiedalerting/fetchGrafanaAnnotations',
  updateAlertManagerConfig: 'unifiedalerting/updateAMConfig',
  deleteAlertManagerConfig: 'unifiedalerting/deleteAlertManagerConfig',
} as const;
