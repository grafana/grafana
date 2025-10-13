import { FailedCheckSummary, ServiceFailedCheck } from 'app/percona/check/types';
import { PaginatedFomattedResponse, Severity } from 'app/percona/shared/core';

/**
 * A mock version of CheckService
 */
export const CheckService = {
  async runDbChecks(): Promise<void | {}> {
    return {};
  },
  async changeCheck(): Promise<void | {}> {
    return {};
  },
  async getFailedCheckForService(): Promise<PaginatedFomattedResponse<ServiceFailedCheck[]>> {
    return {
      totals: {
        totalItems: 2,
        totalPages: 1,
      },
      data: [
        {
          summary: 'first failed check',
          description: 'check 1',
          severity: Severity.SEVERITY_CRITICAL,
          labels: { primary: [], secondary: [] },
          readMoreUrl: 'localhost/check-one',
          serviceName: 'Service One',
          checkName: 'Check One',
          silenced: false,
          alertId: 'alert_1',
        },
        {
          summary: 'second failed check',
          description: 'check 2',
          severity: Severity.SEVERITY_NOTICE,
          labels: { primary: [], secondary: [] },
          readMoreUrl: '',
          serviceName: 'Service One',
          checkName: 'Check Two',
          silenced: false,
          alertId: 'alert_2',
        },
      ],
    };
  },
  async getAllFailedChecks(): Promise<FailedCheckSummary[]> {
    return [
      {
        serviceName: 'Service One',
        serviceId: 's1',
        counts: {
          emergency: 0,
          alert: 0,
          critical: 0,
          error: 0,
          warning: 0,
          notice: 0,
          info: 0,
          debug: 0,
        },
      },
    ];
  },
};
