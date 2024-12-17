import { t } from 'i18next';

import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';

import { validationSrv } from '../services/ValidationSrv';

export const validateDashboardJson = (json: string) => {
  let dashboard;
  try {
    dashboard = JSON.parse(json);
  } catch (error) {
    return t('dashboard.validation.invalid-json', 'Not valid JSON');
  }
  if (dashboard && dashboard.hasOwnProperty('tags')) {
    if (Array.isArray(dashboard.tags)) {
      const hasInvalidTag = dashboard.tags.some((tag: string) => typeof tag !== 'string');
      if (hasInvalidTag) {
        return t('dashboard.validation.tags-expected-strings', 'tags expected array of strings');
      }
    } else {
      return t('dashboard.validation.tags-expected-array', 'tags expected array');
    }
  }
  return true;
};

export const validateGcomDashboard = (gcomDashboard: string) => {
  // From DashboardImportCtrl
  const match = /(^\d+$)|dashboards\/(\d+)/.exec(gcomDashboard);

  return match && (match[1] || match[2])
    ? true
    : t('dashboard.validation.invalid-dashboard-id', 'Could not find a valid Grafana.com ID');
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
  return getDashboardAPI()
    .getDashboardDTO(value)
    .then((existingDashboard) => {
      return `Dashboard named '${existingDashboard?.dashboard.title}' in folder '${existingDashboard?.meta.folderTitle}' has the same UID`;
    })
    .catch((error) => {
      error.isHandled = true;
      return true;
    });
};
