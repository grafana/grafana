import { API, PaginatedFomattedResponse } from 'app/percona/shared/core';
import { api } from 'app/percona/shared/helpers/api';
import { CancelToken } from 'axios';
import {
  AllChecks,
  ChangeCheckBody,
  CheckDetails,
  CheckResultForServicePayload,
  CheckResultSummaryPayload,
  FailedCheckSummary,
  ServiceFailedCheck,
} from 'app/percona/check/types';
import { AlertRuleSeverity } from '../integrated-alerting/components/AlertRules/AlertRules.types';
import { formatLabels } from '../shared/helpers/labels';

export const makeApiUrl: (segment: string) => string = (segment) => `${API.ALERTMANAGER}/${segment}`;
const order = {
  [AlertRuleSeverity.SEVERITY_CRITICAL]: 1,
  [AlertRuleSeverity.SEVERITY_ERROR]: 2,
  [AlertRuleSeverity.SEVERITY_WARNING]: 3,
  [AlertRuleSeverity.SEVERITY_NOTICE]: 4,
};
const BASE_URL = '/v1/management/SecurityChecks';

/**
 * A service-like object to store the API methods
 */
export const CheckService = {
  async getAllFailedChecks(token?: CancelToken): Promise<FailedCheckSummary[]> {
    const { result = [] } = await api.post<CheckResultSummaryPayload, Object>(
      `${BASE_URL}/ListFailedServices`,
      {},
      false,
      token
    );

    return result.map(({ service_name, service_id, critical_count = 0, warning_count = 0, notice_count = 0 }) => ({
      serviceName: service_name,
      serviceId: service_id,
      criticalCount: critical_count,
      warningCount: warning_count,
      noticeCount: notice_count,
    }));
  },
  async getFailedCheckForService(
    serviceId: string,
    pageSize: number,
    pageIndex: number,
    token?: CancelToken
  ): Promise<PaginatedFomattedResponse<ServiceFailedCheck[]>> {
    const {
      results = [],
      page_totals: { total_items: totalItems = 0, total_pages: totalPages = 1 },
    } = await api.post<CheckResultForServicePayload, Object>(
      `${BASE_URL}/FailedChecks`,
      { service_id: serviceId, page_params: { page_size: pageSize, index: pageIndex } },
      false,
      token
    );

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
            severity: AlertRuleSeverity[severity],
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
  async silenceAlert(alertId: string, silence: boolean, token?: CancelToken) {
    return api.post<void, any>(
      `${BASE_URL}/ToggleCheckAlert`,
      {
        alert_id: alertId,
        silence,
      },
      false,
      token
    );
  },
  runDbChecks(token?: CancelToken): Promise<void | {}> {
    return api.post<{}, {}>('/v1/management/SecurityChecks/Start', {}, false, token);
  },
  runIndividualDbCheck(checkName: string, token?: CancelToken): Promise<void | {}> {
    return api.post<{}, {}>(
      '/v1/management/SecurityChecks/Start',
      {
        names: [checkName],
      },
      false,
      token
    );
  },
  async getAllChecks(token?: CancelToken): Promise<CheckDetails[] | undefined> {
    const response = await api.post<AllChecks, {}>('/v1/management/SecurityChecks/List', {}, false, token);

    return response ? response.checks : undefined;
  },
  changeCheck(body: ChangeCheckBody, token?: CancelToken): Promise<void | {}> {
    return api.post<{}, ChangeCheckBody>('/v1/management/SecurityChecks/Change', body, false, token);
  },
};
