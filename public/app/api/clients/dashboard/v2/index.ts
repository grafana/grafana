import { generatedAPI } from './endpoints.gen';

export const folderAPI = generatedAPI.enhanceEndpoints({});

export const { useGetDashboardQuery } = folderAPI;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { type DashboardSpec, type Dashboard } from './endpoints.gen';
