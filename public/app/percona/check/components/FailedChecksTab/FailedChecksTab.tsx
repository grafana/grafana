import { LoaderButton, logger } from '@percona/platform-core';
import React, { FC, useEffect, useState, useCallback } from 'react';

import { AppEvents } from '@grafana/data';
import { Spinner, Switch, useStyles } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { AlertsReloadContext } from 'app/percona/check/Check.context';
import { CheckService } from 'app/percona/check/Check.service';
import { Table } from 'app/percona/integrated-alerting/components/Table';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';

import { COLUMNS } from '../../CheckPanel.constants';
import { ActiveCheck } from '../../types';

import { GET_ACTIVE_ALERTS_CANCEL_TOKEN } from './FailedChecksTab.constants';
import { Messages } from './FailedChecksTab.messages';
import { getStyles } from './FailedChecksTab.styles';
import { loadShowSilencedValue, saveShowSilencedValue } from './FailedChecksTab.utils';

export const FailedChecksTab: FC = () => {
  const [fetchAlertsPending, setFetchAlertsPending] = useState(true);
  const [runChecksPending, setRunChecksPending] = useState(false);
  const [showSilenced, setShowSilenced] = useState(loadShowSilencedValue());
  const [dataSource, setDataSource] = useState<ActiveCheck[] | undefined>();
  const styles = useStyles(getStyles);
  const [generateToken] = useCancelToken();

  const fetchAlerts = useCallback(async (): Promise<void> => {
    setFetchAlertsPending(true);

    try {
      const dataSource = await CheckService.getActiveAlerts(
        showSilenced,
        generateToken(GET_ACTIVE_ALERTS_CANCEL_TOKEN)
      );
      setDataSource(dataSource);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setFetchAlertsPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSilenced]);

  const handleRunChecksClick = async () => {
    setRunChecksPending(true);
    try {
      await CheckService.runDbChecks();
      appEvents.emit(AppEvents.alertSuccess, [Messages.checksExecutionStarted]);
    } catch (e) {
      logger.error(e);
    } finally {
      setRunChecksPending(false);
    }
  };

  const toggleShowSilenced = () => {
    setShowSilenced((currentValue) => !currentValue);
  };

  useEffect(() => {
    fetchAlerts();
    saveShowSilencedValue(showSilenced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSilenced]);

  return (
    <>
      <div className={styles.header}>
        <div className={styles.actionButtons} data-testid="db-check-panel-actions">
          <span className={styles.showAll}>
            <span data-testid="db-checks-failed-checks-toggle-silenced">
              <Switch value={showSilenced} onChange={toggleShowSilenced} />
            </span>
            <span>{Messages.showAll}</span>
          </span>
          <LoaderButton
            type="button"
            size="md"
            loading={runChecksPending}
            onClick={handleRunChecksClick}
            className={styles.runChecksButton}
          >
            {Messages.runDbChecks}
          </LoaderButton>
        </div>
      </div>
      <AlertsReloadContext.Provider value={{ fetchAlerts }}>
        {fetchAlertsPending ? (
          <div className={styles.spinner} data-testid="db-checks-failed-checks-spinner">
            <Spinner />
          </div>
        ) : (
          <Table data={dataSource} columns={COLUMNS} />
        )}
      </AlertsReloadContext.Provider>
    </>
  );
};
