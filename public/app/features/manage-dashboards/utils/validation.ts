import { getBackendSrv } from '@grafana/runtime';

import { validationSrv } from '../services/ValidationSrv';

export const validateDashboardJson = (json: string) => {
  let dashboard = JSON.parse(json);
  if (dashboard && dashboard.tags) {
    if (Array.isArray(dashboard.tags)) {
      const hasInvalidTag = dashboard.tags.some((tag: string) => typeof tag !== 'string');
      if (hasInvalidTag) {
        return 'error: tags expected Array of Strings';
      }
    } else {
      return 'error: tags expected Array';
    }
  }
  return true;
};

export const validateGcomDashboard = (gcomDashboard: string) => {
  // From DashboardImportCtrl
  const match = /(^\d+$)|dashboards\/(\d+)/.exec(gcomDashboard);

  return match && (match[1] || match[2]) ? true : 'Could not find a valid Grafana.com ID';
};

export const validateTitle = (newTitle: string, folderId: number) => {
  return validationSrv
    .validateNewDashboardName(folderId, newTitle)
    .then(() => {
      return true;
    })
    .catch((error) => {
      if (error.type === 'EXISTING') {
        return error.message;
      }
    });
};

export const validateUid = (value: string) => {
  return getBackendSrv()
    .get(`/api/dashboards/uid/${value}`)
    .then((existingDashboard) => {
      return `Dashboard named '${existingDashboard?.dashboard.title}' in folder '${existingDashboard?.meta.folderTitle}' has the same UID`;
    })
    .catch((error) => {
      error.isHandled = true;
      return true;
    });
};
