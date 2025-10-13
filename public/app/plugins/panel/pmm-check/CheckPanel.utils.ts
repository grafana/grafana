import { FailedChecksCounts, FailedCheckSummary } from 'app/percona/check/types';

export const splitSeverities = (checks: FailedCheckSummary[] = []): FailedChecksCounts => {
  const result: FailedChecksCounts = {
    emergency: 0,
    critical: 0,
    alert: 0,
    error: 0,
    warning: 0,
    debug: 0,
    info: 0,
    notice: 0,
  };

  checks.forEach(({ counts: { emergency, critical, alert, error, warning, debug, info, notice } }) => {
    result.emergency += emergency;
    result.critical += critical;
    result.alert += alert;
    result.error += error;
    result.warning += warning;
    result.debug += debug;
    result.info += info;
    result.notice += notice;
  });

  return result;
};
