/* eslint-disable @typescript-eslint/no-explicit-any */
import { CancelToken } from 'axios';

import {
  ChangeCheckBody,
  CheckResultForServicePayload,
  CheckResultSummaryPayload,
  FailedCheckSummary,
  ServiceFailedCheck,
} from 'app/percona/check/types';
import { API, PaginatedFomattedResponse, Severity } from 'app/percona/shared/core';
import { api } from 'app/percona/shared/helpers/api';

import { formatLabels } from '../shared/helpers/labels';

export const makeApiUrl: (segment: string) => string = (segment) => `${API.ALERTMANAGER}/${segment}`;
const order = {
  [Severity.SEVERITY_EMERGENCY]: 1,
  [Severity.SEVERITY_ALERT]: 2,
  [Severity.SEVERITY_CRITICAL]: 3,
  [Severity.SEVERITY_ERROR]: 4,
  [Severity.SEVERITY_WARNING]: 5,
  [Severity.SEVERITY_NOTICE]: 6,
  [Severity.SEVERITY_INFO]: 7,
  [Severity.SEVERITY_DEBUG]: 8,
};
const BASE_URL = '/v1/advisors';

/**
 * A service-like object to store the API methods
 */
export const CheckService = {
  async getAllFailedChecks(token?: CancelToken, disableNotifications?: boolean): Promise<FailedCheckSummary[]> {
    const { result = [] } = await api.get<CheckResultSummaryPayload, void>(
      `${BASE_URL}/failedServices`,
      disableNotifications,
      {
        cancelToken: token,
      }
    );

    return result
      .map(
        ({
          service_name,
          service_id,
          emergency_count = '0',
          alert_count = '0',
          critical_count = '0',
          error_count = '0',
          warning_count = '0',
          notice_count = '0',
          info_count = '0',
          debug_count = '0',
        }) => ({
          serviceName: service_name,
          serviceId: service_id,
          counts: {
            emergency: parseInt(emergency_count, 10),
            alert: parseInt(alert_count, 10),
            critical: parseInt(critical_count, 10),
            error: parseInt(error_count, 10),
            warning: parseInt(warning_count, 10),
            notice: parseInt(notice_count, 10),
            info: parseInt(info_count, 10),
            debug: parseInt(debug_count, 10),
          },
        })
      )
      .sort((a, b) => a.serviceName.localeCompare(b.serviceName));
  },
  async getFailedCheckForService(
    serviceId: string,
    pageSize: number,
    pageIndex: number,
    token?: CancelToken
  ): Promise<PaginatedFomattedResponse<ServiceFailedCheck[]>> {
    const {
      results = [],
      total_items: totalItems = 0,
      total_pages: totalPages = 1,
    } = await api.get<
      CheckResultForServicePayload,
      {
        service_id: string;
        page_size: number;
        page_index: number;
      }
    >(`${BASE_URL}/checks/failed`, false, {
      cancelToken: token,
      params: { service_id: serviceId, page_size: pageSize, page_index: pageIndex },
    });

    return {
      totals: {
        totalItems,
        totalPages,
      },
      data: results
        .map(
          ({
            summary,
            description,
            severity,
            labels = {},
            read_more_url,
            service_name,
            check_name,
            silenced,
            alert_id,
          }) => ({
            summary,
            description,
            severity: Severity[severity],
            labels: formatLabels(labels),
            readMoreUrl: read_more_url,
            serviceName: service_name,
            checkName: check_name,
            silenced: !!silenced,
            alertId: alert_id,
          })
        )
        .sort((a, b) => order[a.severity] - order[b.severity]),
    };
  },
  runDbChecks(checkNames: string[], token?: CancelToken): Promise<void | {}> {
    return api.post<{}, {}>(
      `${BASE_URL}/checks:start`,
      {
        names: checkNames,
      },
      false,
      token
    );
  },
  runIndividualDbCheck(checkName: string, token?: CancelToken): Promise<void | {}> {
    return api.post<{}, {}>(
      `${BASE_URL}/checks:start`,
      {
        names: [checkName],
      },
      false,
      token
    );
  },
  changeCheck(body: ChangeCheckBody, token?: CancelToken): Promise<void | {}> {
    return api.post<{}, ChangeCheckBody>(`${BASE_URL}/checks:batchChange`, body, false, token);
  },
};
