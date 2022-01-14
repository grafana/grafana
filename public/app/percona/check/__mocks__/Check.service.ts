import { SEVERITIES_ORDER } from 'app/percona/check/CheckPanel.constants';
import {
  ActiveCheck,
  Alert,
  CheckDetails,
  FailedChecks,
  Settings,
  SilenceResponse,
  AlertState,
} from 'app/percona/check/types';

import { alertsStub } from './stubs';

/**
 * A mock version of CheckService
 */
export const CheckService = {
  async getActiveAlerts(): Promise<ActiveCheck[] | undefined> {
    return processData(alertsStub as Alert[]);
  },
  async getFailedChecks(): Promise<FailedChecks | undefined> {
    return sumFailedChecks(processData(alertsStub as Alert[]));
  },
  async runDbChecks(): Promise<void | {}> {
    return {};
  },
  async silenceAlert(): Promise<void | SilenceResponse> {
    return { silenceID: 'test' };
  },
  async getSettings(): Promise<Settings | {}> {
    return {};
  },
  async getAllChecks(): Promise<CheckDetails[] | undefined> {
    return [];
  },
  async changeCheck(): Promise<void | {}> {
    return {};
  },
};

export const processData = (data: Alert[]): ActiveCheck[] => {
  const result: Record<
    string,
    Array<{
      summary: string;
      description: string;
      severity: string;
      labels: { [key: string]: string };
      silenced: boolean;
    }>
  > = data
    .filter((alert) => !!alert.labels.stt_check)
    .reduce((acc, alert) => {
      const {
        labels,
        annotations: { summary, description },
      } = alert;
      const serviceName = labels.service_name;

      if (!serviceName) {
        return acc;
      }

      const item = {
        summary,
        description,
        severity: labels.severity,
        labels,
        silenced: AlertState.suppressed,
      };

      if (acc[serviceName]) {
        acc[serviceName] = acc[serviceName].concat(item);
      } else {
        acc[serviceName] = [item];
      }

      return acc;
    }, {});

  return Object.entries(result).map(([name, value], i) => {
    const failed = value.reduce(
      (acc, val) => {
        if (val.severity === 'error') {
          acc[SEVERITIES_ORDER.error] += 1;
        }

        if (val.severity === 'warning') {
          acc[SEVERITIES_ORDER.warning] += 1;
        }

        if (val.severity === 'notice') {
          acc[SEVERITIES_ORDER.notice] += 1;
        }

        return acc;
      },
      [0, 0, 0] as FailedChecks
    );

    const details = value
      .map((val) => ({
        description: `${val.summary}${val.description ? `: ${val.description}` : ''}`,
        labels: val.labels ?? [],
        silenced: val.silenced,
      }))
      .sort((a, b) => {
        const aSeverity = a.labels.severity;
        const bSeverity = b.labels.severity;

        return SEVERITIES_ORDER[aSeverity] - SEVERITIES_ORDER[bSeverity];
      });

    return {
      key: String(i),
      name,
      failed,
      details,
    };
  });
};

export const sumFailedChecks = (checks: ActiveCheck[]): FailedChecks =>
  checks
    .map((rec) => rec.failed)
    .reduce(
      (acc, failed) => {
        acc[0] += failed[0];
        acc[1] += failed[1];
        acc[2] += failed[2];

        return acc;
      },
      [0, 0, 0]
    );
