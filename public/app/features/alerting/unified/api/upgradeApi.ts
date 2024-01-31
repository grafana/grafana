import { FetchError, isFetchError } from '@grafana/runtime';

import {
  createErrorNotification,
  createSuccessNotification,
  createWarningNotification,
} from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { ObjectMatcher } from '../../../../plugins/datasource/alertmanager/types';

import { alertingApi } from './alertingApi';

export interface OrgMigrationSummary {
  newDashboards: number;
  newAlerts: number;
  newChannels: number;
  removed: boolean;
  hasErrors: boolean;
}

export interface OrgMigrationState {
  orgId: number;
  migratedDashboards: DashboardUpgrade[];
  migratedChannels: ContactPair[];
  errors: string[];
}

export interface DashboardUpgrade {
  migratedAlerts: AlertPair[];
  dashboardId: number;
  dashboardUid: string;
  dashboardName: string;
  folderUid: string;
  folderName: string;
  newFolderUid?: string;
  newFolderName?: string;
  provisioned: boolean;
  error?: string;
  warning: string;

  isUpgrading: boolean;
}

export interface AlertPair {
  legacyAlert: LegacyAlert;
  alertRule?: AlertRuleUpgrade;
  error?: string;

  isUpgrading: boolean;
}

export interface ContactPair {
  legacyChannel: LegacyChannel;
  contactPoint?: ContactPointUpgrade;
  provisioned: boolean;
  error?: string;

  isUpgrading: boolean;
}

export interface LegacyAlert {
  id: number;
  dashboardId: number;
  panelId: number;
  name: string;
}

export interface AlertRuleUpgrade {
  uid: string;
  title: string;
  sendsTo: string[];
}

export interface LegacyChannel {
  id: number;
  name: string;
  type: string;
}

export interface ContactPointUpgrade {
  name: string;
  type: string;
  routeMatchers: ObjectMatcher[];
}

function isFetchBaseQueryError(error: unknown): error is { error: FetchError } {
  return typeof error === 'object' && error != null && 'error' in error;
}

export const upgradeApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    upgradeChannel: build.mutation<OrgMigrationSummary, { channelId: number; skipExisting: boolean }>({
      query: ({ channelId, skipExisting }) => ({
        url: `/api/v1/upgrade/channels/${channelId}${skipExisting ? '?skipExisting=true' : ''}`,
        method: 'POST',
        showSuccessAlert: false,
        showErrorAlert: false,
      }),
      invalidatesTags: ['OrgMigrationState'],
      async onQueryStarted({ channelId }, { dispatch, queryFulfilled }) {
        try {
          dispatch(
            upgradeApi.util.updateQueryData('getOrgUpgradeSummary', undefined, (draft) => {
              const index = (draft.migratedChannels ?? []).findIndex((pair) => pair.legacyChannel?.id === channelId);
              if (index !== -1) {
                draft.migratedChannels[index].isUpgrading = true;
              }
            })
          );
          const { data } = await queryFulfilled;
          if (data.hasErrors) {
            dispatch(notifyApp(createWarningNotification(`Failed to upgrade notification channel '${channelId}'`)));
          } else {
            if (data.removed) {
              dispatch(
                notifyApp(
                  createSuccessNotification(
                    `Notification channel '${channelId}' not found, removed from list of upgrades`
                  )
                )
              );
            } else {
              dispatch(notifyApp(createSuccessNotification(`Upgraded notification channel '${channelId}'`)));
            }
          }
        } catch (e) {
          if (isFetchBaseQueryError(e) && isFetchError(e.error)) {
            dispatch(notifyApp(createErrorNotification('Request failed', e.error.data.message)));
          } else {
            dispatch(notifyApp(createErrorNotification(`Request failed`)));
          }
        }
      },
    }),
    upgradeAllChannels: build.mutation<OrgMigrationSummary, { skipExisting: boolean }>({
      query: ({ skipExisting }) => ({
        url: `/api/v1/upgrade/channels${skipExisting ? '?skipExisting=true' : ''}`,
        method: 'POST',
        showSuccessAlert: false,
        showErrorAlert: false,
      }),
      invalidatesTags: ['OrgMigrationState'],
      async onQueryStarted({ skipExisting }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.hasErrors) {
            dispatch(
              notifyApp(
                createWarningNotification(
                  `Issues while upgrading ${data.newChannels} ${skipExisting ? 'new ' : ''}notification channels`
                )
              )
            );
          } else {
            dispatch(
              notifyApp(
                createSuccessNotification(
                  `Upgraded ${data.newChannels} ${skipExisting ? 'new ' : ''}notification channels`
                )
              )
            );
          }
        } catch (e) {
          if (isFetchBaseQueryError(e) && isFetchError(e.error)) {
            dispatch(notifyApp(createErrorNotification('Request failed', e.error.data.message)));
          } else {
            dispatch(notifyApp(createErrorNotification(`Request failed`)));
          }
        }
      },
    }),
    upgradeAlert: build.mutation<OrgMigrationSummary, { dashboardId: number; panelId: number; skipExisting: boolean }>({
      query: ({ dashboardId, panelId, skipExisting }) => ({
        url: `/api/v1/upgrade/dashboards/${dashboardId}/panels/${panelId}${skipExisting ? '?skipExisting=true' : ''}`,
        method: 'POST',
        showSuccessAlert: false,
        showErrorAlert: false,
      }),
      invalidatesTags: ['OrgMigrationState'],
      async onQueryStarted({ dashboardId, panelId }, { dispatch, queryFulfilled }) {
        try {
          dispatch(
            upgradeApi.util.updateQueryData('getOrgUpgradeSummary', undefined, (draft) => {
              const index = (draft.migratedDashboards ?? []).findIndex((du) => du.dashboardId === dashboardId);
              if (index !== -1) {
                const alertIndex = (draft.migratedDashboards[index]?.migratedAlerts ?? []).findIndex(
                  (pair) => pair.legacyAlert?.panelId === panelId
                );
                if (alertIndex !== -1) {
                  draft.migratedDashboards[index].migratedAlerts[alertIndex].isUpgrading = true;
                }
              }
            })
          );
          const { data } = await queryFulfilled;
          if (data.hasErrors) {
            dispatch(
              notifyApp(
                createWarningNotification(`Failed to upgrade alert from dashboard '${dashboardId}', panel '${panelId}'`)
              )
            );
          } else {
            if (data.removed) {
              dispatch(
                notifyApp(
                  createSuccessNotification(
                    `Alert from dashboard '${dashboardId}', panel '${panelId}' not found, removed from list of upgrades`
                  )
                )
              );
            } else {
              dispatch(
                notifyApp(
                  createSuccessNotification(`Upgraded alert from dashboard '${dashboardId}', panel '${panelId}'`)
                )
              );
            }
          }
        } catch (e) {
          if (isFetchBaseQueryError(e) && isFetchError(e.error)) {
            dispatch(notifyApp(createErrorNotification('Request failed', e.error.data.message)));
          } else {
            dispatch(notifyApp(createErrorNotification(`Request failed`)));
          }
        }
      },
    }),
    upgradeDashboard: build.mutation<OrgMigrationSummary, { dashboardId: number; skipExisting: boolean }>({
      query: ({ dashboardId, skipExisting }) => ({
        url: `/api/v1/upgrade/dashboards/${dashboardId}${skipExisting ? '?skipExisting=true' : ''}`,
        method: 'POST',
        showSuccessAlert: false,
        showErrorAlert: false,
      }),
      invalidatesTags: ['OrgMigrationState'],
      async onQueryStarted({ dashboardId, skipExisting }, { dispatch, queryFulfilled }) {
        try {
          dispatch(
            upgradeApi.util.updateQueryData('getOrgUpgradeSummary', undefined, (draft) => {
              const index = (draft.migratedDashboards ?? []).findIndex((du) => du.dashboardId === dashboardId);
              if (index !== -1) {
                draft.migratedDashboards[index].isUpgrading = true;
              }
            })
          );
          const { data } = await queryFulfilled;
          if (data.hasErrors) {
            dispatch(
              notifyApp(
                createWarningNotification(
                  `Issues while upgrading ${data.newAlerts} ${
                    skipExisting ? 'new ' : ''
                  }alerts from dashboard '${dashboardId}'`
                )
              )
            );
          } else {
            if (data.removed) {
              dispatch(
                notifyApp(
                  createSuccessNotification(`Dashboard '${dashboardId}' not found, removed from list of upgrades`)
                )
              );
            } else {
              dispatch(
                notifyApp(
                  createSuccessNotification(
                    `Upgraded ${data.newAlerts} ${skipExisting ? 'new ' : ''}alerts from dashboard '${dashboardId}'`
                  )
                )
              );
            }
          }
        } catch (e) {
          if (isFetchBaseQueryError(e) && isFetchError(e.error)) {
            dispatch(notifyApp(createErrorNotification('Request failed', e.error.data.message)));
          } else {
            dispatch(notifyApp(createErrorNotification(`Request failed`)));
          }
        }
      },
    }),
    upgradeAllDashboards: build.mutation<OrgMigrationSummary, { skipExisting: boolean }>({
      query: ({ skipExisting }) => ({
        url: `/api/v1/upgrade/dashboards${skipExisting ? '?skipExisting=true' : ''}`,
        method: 'POST',
        showSuccessAlert: false,
        showErrorAlert: false,
      }),
      invalidatesTags: ['OrgMigrationState'],
      async onQueryStarted({ skipExisting }, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.hasErrors) {
            dispatch(
              notifyApp(
                createWarningNotification(
                  `Issues while upgrading ${data.newAlerts} ${skipExisting ? 'new ' : ''}alerts in ${
                    data.newDashboards
                  } dashboards`
                )
              )
            );
          } else {
            dispatch(
              notifyApp(
                createSuccessNotification(
                  `Upgraded ${data.newAlerts} ${skipExisting ? 'new ' : ''}alerts in ${data.newDashboards} dashboards`
                )
              )
            );
          }
        } catch (e) {
          if (isFetchBaseQueryError(e) && isFetchError(e.error)) {
            dispatch(notifyApp(createErrorNotification('Request failed', e.error.data.message)));
          } else {
            dispatch(notifyApp(createErrorNotification(`Request failed`)));
          }
        }
      },
    }),
    upgradeOrg: build.mutation<OrgMigrationSummary, { skipExisting: boolean }>({
      query: ({ skipExisting }) => ({
        url: `/api/v1/upgrade/org${skipExisting ? '?skipExisting=true' : ''}`,
        method: 'POST',
        showSuccessAlert: false,
        showErrorAlert: false,
      }),
      invalidatesTags: ['OrgMigrationState'],
      async onQueryStarted({ skipExisting }, { dispatch, getCacheEntry, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data.hasErrors) {
            dispatch(
              notifyApp(
                createWarningNotification(
                  `Issues while upgrading ${data.newAlerts} ${skipExisting ? 'new ' : ''}alerts in ${
                    data.newDashboards
                  } dashboards and ${data.newChannels} ${skipExisting ? 'new ' : ''}notification channels`
                )
              )
            );
          } else {
            dispatch(
              notifyApp(
                createSuccessNotification(
                  `Upgraded ${data.newAlerts} ${skipExisting ? 'new ' : ''}alerts in ${
                    data.newDashboards
                  } dashboards and ${data.newChannels} ${skipExisting ? 'new ' : ''}notification channels`
                )
              )
            );
          }
        } catch (e) {
          if (isFetchBaseQueryError(e) && isFetchError(e.error)) {
            dispatch(notifyApp(createErrorNotification('Request failed', e.error.data.message)));
          } else {
            dispatch(notifyApp(createErrorNotification(`Request failed`)));
          }
        }
      },
    }),
    cancelOrgUpgrade: build.mutation<void, void>({
      query: () => ({
        url: `/api/v1/upgrade/org`,
        method: 'DELETE',
      }),
      invalidatesTags: ['OrgMigrationState'],
      async onQueryStarted(undefined, { dispatch }) {
        // This helps prevent flickering of old tables after the cancel button is clicked.
        try {
          dispatch(
            upgradeApi.util.updateQueryData('getOrgUpgradeSummary', undefined, (draft) => {
              const defaultState: OrgMigrationState = {
                orgId: 0,
                migratedDashboards: [],
                migratedChannels: [],
                errors: [],
              };
              Object.assign(draft, defaultState);
            })
          );
        } catch {}
      },
    }),
    getOrgUpgradeSummary: build.query<OrgMigrationState, void>({
      query: () => ({
        url: `/api/v1/upgrade/org`,
      }),
      providesTags: ['OrgMigrationState'],
      transformResponse: (summary: OrgMigrationState): OrgMigrationState => {
        summary.migratedDashboards = summary.migratedDashboards ?? [];
        summary.migratedChannels = summary.migratedChannels ?? [];
        summary.errors = summary.errors ?? [];

        // Sort to show the most problematic rows first.
        summary.migratedDashboards.forEach((dashUpgrade) => {
          // dashUpgrade.isUpgrading = false;
          dashUpgrade.migratedAlerts = dashUpgrade.migratedAlerts ?? [];
          dashUpgrade.error = dashUpgrade.error ?? '';
          dashUpgrade.warning = dashUpgrade.warning ?? '';
          dashUpgrade.migratedAlerts.sort((a, b) => {
            const byError = (b.error ?? '').localeCompare(a.error ?? '');
            if (byError !== 0) {
              return byError;
            }
            return (a.legacyAlert?.name ?? '').localeCompare(b.legacyAlert?.name ?? '');
          });
        });
        summary.migratedDashboards.sort((a, b) => {
          const byErrors = (b.error ?? '').localeCompare(a.error ?? '');
          if (byErrors !== 0) {
            return byErrors;
          }
          const byNestedErrors =
            b.migratedAlerts.filter((a) => a.error).length - a.migratedAlerts.filter((a) => a.error).length;
          if (byNestedErrors !== 0) {
            return byNestedErrors;
          }
          const byWarnings = (b.warning ?? '').localeCompare(a.warning ?? '');
          if (byWarnings !== 0) {
            return byWarnings;
          }
          const byFolder = a.folderName.localeCompare(b.folderName);
          if (byFolder !== 0) {
            return byFolder;
          }
          return a.dashboardName.localeCompare(b.dashboardName);
        });

        // Sort contacts.
        summary.migratedChannels.sort((a, b) => {
          const byErrors = (b.error ? 1 : 0) - (a.error ? 1 : 0);
          if (byErrors !== 0) {
            return byErrors;
          }
          return (a.legacyChannel?.name ?? '').localeCompare(b.legacyChannel?.name ?? '');
        });

        return summary;
      },
    }),
  }),
});
