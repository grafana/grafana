import { BaseQueryFn, createApi } from '@reduxjs/toolkit/query/react';
import { defaultsDeep } from 'lodash';
import { lastValueFrom } from 'rxjs';

import { AppEvents } from '@grafana/data';
import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';

import { logMeasurement } from '../Analytics';

export type ExtendedBackendSrvRequest = BackendSrvRequest & {
  /**
   * Custom success message to show after completion of the request.
   *
   * If a custom message is provided, any success message provided from the API response
   * will not be shown
   */
  successMessage?: string;
  /**
   * Custom error message to show if there's an error completing the request via backendSrv.
   *
   * If a custom message is provided, any error message from the API response
   * will not be shown
   */
  errorMessage?: string;
};

// utility type for passing request options to endpoints
export type WithRequestOptions<T> = T & {
  requestOptions?: Partial<ExtendedBackendSrvRequest>;
};

export function withRequestOptions(
  options: BackendSrvRequest,
  requestOptions: Partial<ExtendedBackendSrvRequest> = {},
  defaults: Partial<ExtendedBackendSrvRequest> = {}
): ExtendedBackendSrvRequest {
  return {
    ...options,
    ...defaultsDeep(requestOptions, defaults),
  };
}

export const backendSrvBaseQuery =
  (): BaseQueryFn<ExtendedBackendSrvRequest> =>
  async ({ successMessage, errorMessage, ...requestOptions }) => {
    try {
      const modifiedRequestOptions: BackendSrvRequest = {
        ...requestOptions,
        ...(successMessage && { showSuccessAlert: false }),
        ...(errorMessage && { showErrorAlert: false }),
      };

      const requestStartTs = performance.now();

      const { data, ...meta } = await lastValueFrom(getBackendSrv().fetch(modifiedRequestOptions));

      logMeasurement(
        'backendSrvBaseQuery',
        {
          loadTimeMs: performance.now() - requestStartTs,
        },
        {
          url: requestOptions.url,
          method: requestOptions.method ?? 'GET',
          responseStatus: meta.statusText,
        }
      );

      if (successMessage && requestOptions.showSuccessAlert !== false) {
        appEvents.emit(AppEvents.alertSuccess, [successMessage]);
      }
      return { data, meta };
    } catch (error) {
      if (errorMessage && requestOptions.showErrorAlert !== false) {
        appEvents.emit(AppEvents.alertError, [errorMessage]);
      }
      return { error };
    }
  };

export const alertingApi = createApi({
  reducerPath: 'alertingApi',
  baseQuery: backendSrvBaseQuery(),
  tagTypes: [
    'AlertingConfiguration',
    'AlertmanagerConfiguration',
    'AlertmanagerConnectionStatus',
    'AlertmanagerAlerts',
    'AlertmanagerSilences',
    'OnCallIntegrations',
    'OrgMigrationState',
    'DataSourceSettings',
    'GrafanaLabels',
    'CombinedAlertRule',
    'GrafanaRulerRule',
    'GrafanaSlo',
    'RuleGroup',
    'RuleNamespace',
  ],
  endpoints: () => ({}),
});
