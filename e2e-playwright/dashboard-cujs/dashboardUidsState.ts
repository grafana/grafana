export const setDashboardUIDs = (uids: string[]) => {
  process.env.DASHBOARD_UIDS = JSON.stringify(uids);
};

export const getDashboardUIDs = (): string[] => {
  return JSON.parse(process.env.DASHBOARD_UIDS || '[]');
};

export const clearDashboardUIDs = () => {
  delete process.env.DASHBOARD_UIDS;
};
