import { t } from '@grafana/i18n';
import { AnnoKeyFolderTitle } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import { isDashboardV2Resource } from 'app/features/dashboard/api/utils';

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
      const isV2 = isDashboardV2Resource(existingDashboard);
      const dashboard = isV2 ? existingDashboard.spec : existingDashboard.dashboard;
      const folderTitle = isV2
        ? existingDashboard.metadata.annotations?.[AnnoKeyFolderTitle]
        : existingDashboard.meta.folderTitle;
      return `Dashboard named '${dashboard.title}' in folder '${folderTitle}' has the same UID`;
    })
    .catch((error) => {
      error.isHandled = true;

      // when Editor user tries to import admin only dashboard (with same uid) he gets an unhelpful 403 error
      //  therefore handling this use case to return some indication of whats wrong
      if (error.status === 403) {
        return 'Dashboard with the same UID already exists';
      }
      return true;
    });
};
