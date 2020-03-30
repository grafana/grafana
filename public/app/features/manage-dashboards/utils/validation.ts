export const validateDashboardJson = (json: string) => {
  try {
    JSON.parse(json);
    return true;
  } catch (error) {
    return 'Not valid JSON';
  }
};

export const validateGcomDashboard = (gcomDashboard: string) => {
  // From DashboardImportCtrl
  const match = /(^\d+$)|dashboards\/(\d+)/.exec(gcomDashboard);

  return match && (match[1] || match[2]) ? true : 'Could not find a valid Grafana.com id';
};
