import { locationUtil, TimeRange } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Panel } from '@grafana/schema';
import store from 'app/core/store';
import { DASHBOARD_SCHEMA_VERSION } from 'app/features/dashboard/state/DashboardMigrator';
import { DASHBOARD_FROM_LS_KEY, DashboardDTO } from 'app/types';

export enum GenericError {
  UNKNOWN = 'unknown-error',
  NAVIGATION = 'navigation-error',
}

export interface SubmissionError {
  error: AddToDashboardError | GenericError;
  message: string;
}

export enum AddToDashboardError {
  FETCH_DASHBOARD = 'fetch-dashboard',
  SET_DASHBOARD_LS = 'set-dashboard-ls-error',
}

interface AddPanelToDashboardOptions {
  panel: Panel;
  dashboardUid?: string;
  openInNewTab?: boolean;
  timeRange?: TimeRange;
}

export function addToDashboard({
  panel,
  dashboardUid,
  openInNewTab,
  timeRange,
}: AddPanelToDashboardOptions): SubmissionError | undefined {
  let dto: DashboardDTO = {
    meta: {},
    dashboard: {
      title: '',
      uid: '',
      panels: [panel],
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
    },
  };

  if (timeRange) {
    const raw = timeRange.raw;
    dto.dashboard.time = {
      from: typeof raw.from === 'string' ? raw.from : raw.from.toISOString(),
      to: typeof raw.to === 'string' ? raw.to : raw.to.toISOString(),
    };
  }

  try {
    store.setObject(DASHBOARD_FROM_LS_KEY, dto);
  } catch {
    return {
      error: AddToDashboardError.SET_DASHBOARD_LS,
      message: 'Could not add panel to dashboard. Please try again.',
    };
  }

  const dashboardURL = getDashboardURL(dashboardUid);

  if (openInNewTab) {
    const didTabOpen = !!global.open(config.appUrl + dashboardURL, '_blank');

    if (!didTabOpen) {
      store.delete(DASHBOARD_FROM_LS_KEY);
      return {
        error: GenericError.NAVIGATION,
        message: 'Could not navigate to the selected dashboard. Please try again.',
      };
    }

    return;
  }

  locationService.push(locationUtil.stripBaseFromUrl(dashboardURL));
  return;
}

function getDashboardURL(dashboardUid?: string) {
  return dashboardUid ? `d/${dashboardUid}` : 'dashboard/new';
}
