import { getBackendSrv } from '@grafana/runtime';

import { validationSrv } from '../services/ValidationSrv';

export const validateDashboardJson = (json: string) => {
  try {
    let dashboard = JSON.parse(json);
    // If dashboard.tags provided && is Array
    if (dashboard.tags && Array.isArray(dashboard.tags)) {
      // Check dashboard.tags in Array for only Strings
      let cont = true;
      dashboard.tags.forEach((tag: string) => {
        if (cont === true && typeof tag !== 'string') {
          cont = false;
        }
      });
      // Continue to import dashboard if Tags in correct format
      if (cont) {
        return true;
      } else {
        return 'error: tags expected Array of Strings';
      }
      // If dashboard.tags && not Array
    } else if (dashboard.tags && !Array.isArray(dashboard.tags)) {
      return 'error: tags expected Array';
      // Else generic JSON test passes and no Tags provided, then import dashboard
    } else {
      return true;
    }
  } catch (error) {
    return 'Not valid JSON';
  }
  if (dashboard.tags) {
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
