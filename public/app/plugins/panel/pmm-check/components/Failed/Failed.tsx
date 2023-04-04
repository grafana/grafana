import { cx } from '@emotion/css';
import { logger } from '@percona/platform-core';
import React, { FC, useCallback, useEffect, useState } from 'react';

import { Spinner, Tooltip, useStyles2 } from '@grafana/ui';
import { CheckService } from 'app/percona/check/Check.service';
import { FailedCheckSummary } from 'app/percona/check/types';
import { getPerconaSettings, getPerconaUser } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';

import { PMM_DATABASE_CHECKS_PANEL_URL, PMM_SETTINGS_URL } from '../../CheckPanel.constants';
import { splitSeverities } from '../../CheckPanel.utils';

import { Messages } from './Failed.messages';
import { getStyles } from './Failed.styles';
import { TooltipText } from './TooltipText';

export const Failed: FC = () => {
  const [failedChecks, setFailedChecks] = useState<FailedCheckSummary[]>([]);
  const { isAuthorized } = useSelector(getPerconaUser);
  const { result: settings, loading: settingsLoading } = useSelector(getPerconaSettings);
  const styles = useStyles2(getStyles);
  const counts = splitSeverities(failedChecks);
  const { emergency, critical, alert, error, warning, debug, info, notice } = counts;
  const sum = emergency + critical + alert + error + warning + debug + info + notice;

  const fetchAlerts = useCallback(async (): Promise<void> => {
    try {
      const checks = await CheckService.getAllFailedChecks();
      setFailedChecks(checks);
    } catch (e) {
      logger.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (settingsLoading) {
    return <Spinner />;
  }

  if (!isAuthorized) {
    return (
      <div className={styles.Empty} data-testid="unauthorized">
        {Messages.insufficientPermissions}
      </div>
    );
  }

  if (!settings?.sttEnabled) {
    return (
      <div className={styles.Empty} data-testid="db-check-panel-settings-link">
        {Messages.featureDisabled}
        <br />
        {Messages.check}
        <a className={styles.Link} href={PMM_SETTINGS_URL}>
          {Messages.pmmSettings}
        </a>
      </div>
    );
  }

  if (!sum) {
    return (
      <div data-testid="db-check-panel-zero-checks">
        <span className={cx(styles.FailedDiv, styles.Green)}>{sum}</span>
      </div>
    );
  }

  return (
    <div data-testid="db-check-panel-has-checks">
      <Tooltip placement="top" interactive content={<TooltipText counts={counts} />}>
        <a href={PMM_DATABASE_CHECKS_PANEL_URL} className={styles.FailedDiv}>
          <span className={styles.Critical} data-testid="db-check-panel-critical">
            {emergency + alert + critical}
          </span>
          <span> / </span>
          <span className={styles.Error} data-testid="db-check-panel-error">
            {error}
          </span>
          <span> / </span>
          <span className={styles.Warning} data-testid="db-check-panel-warning">
            {warning}
          </span>
          <span> / </span>
          <span className={styles.Notice} data-testid="db-check-panel-notice">
            {notice + info + debug}
          </span>
        </a>
      </Tooltip>
    </div>
  );
};
