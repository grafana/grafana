import { getBackendSrv } from '@grafana/runtime';

import { validationSrv } from '../services/ValidationSrv';

export const validateDashboardJson = (json: string) => {
  let dashboard;
  try {
    dashboard = JSON.parse(json);
  } catch (error) {
    return 'Not valid JSON';
  }
  if (dashboard && dashboard.hasOwnProperty('tags')) {
    if (Array.isArray(dashboard.tags)) {
      const hasInvalidTag = dashboard.tags.some((tag: string) => typeof tag !== 'string');
      if (hasInvalidTag) {
        return 'tags expected array of strings';
      }
    } else {
      return 'tags expected array';
    }
  }
  return true;
};

export const validateGcomDashboard = (gcomDashboard: string) => {
  // From DashboardImportCtrl
  const match = /(^\d+$)|dashboards\/(\d+)/.exec(gcomDashboard);

  return match && (match[1] || match[2]) ? true : 'Could not find a valid Grafana.com ID';
};

export const validateTitle = (newTitle: string, folderUid: string) => {
  return validationSrv
    .validateNewDashboardName(folderUid, newTitle)
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
