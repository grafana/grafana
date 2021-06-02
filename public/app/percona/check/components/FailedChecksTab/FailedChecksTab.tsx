import React, { FC, useEffect, useState } from 'react';
import { Table } from 'app/percona/check/components';
import { ActiveCheck } from 'app/percona/check/types';
import { COLUMNS } from 'app/percona/check/CheckPanel.constants';
import { AlertsReloadContext } from 'app/percona/check/Check.context';
import { CheckService } from 'app/percona/check/Check.service';
import { Spinner, Switch, useStyles } from '@grafana/ui';
import { FailedChecksTabProps } from './types';
import { Messages } from './FailedChecksTab.messages';
import { getStyles } from './FailedChecksTab.styles';
import { loadShowSilencedValue, saveShowSilencedValue } from './FailedChecksTab.utils';
import { LoaderButton } from '@percona/platform-core';
import { appEvents } from '../../../../core/app_events';
import { AppEvents } from '@grafana/data';

export const FailedChecksTab: FC<FailedChecksTabProps> = ({ hasNoAccess }) => {
  const [fetchAlertsPending, setFetchAlertsPending] = useState(false);
  const [runChecksPending, setRunChecksPending] = useState(false);
  const [showSilenced, setShowSilenced] = useState(loadShowSilencedValue());
  const [dataSource, setDataSource] = useState<ActiveCheck[] | undefined>();
  const styles = useStyles(getStyles);

  const fetchAlerts = async (): Promise<void> => {
    setFetchAlertsPending(true);

    try {
      const dataSource = await CheckService.getActiveAlerts(showSilenced);

      setDataSource(dataSource);
    } catch (err) {
      console.error(err);
    } finally {
      setFetchAlertsPending(false);
    }
  };

  const handleRunChecksClick = async () => {
    setRunChecksPending(true);
    try {
      await CheckService.runDbChecks();
    } catch (e) {
      console.error(e);
    }
    // TODO (nicolalamacchia): remove this timeout when the API will become synchronous
    setTimeout(async () => {
      setRunChecksPending(false);
      await fetchAlerts();
      appEvents.emit(AppEvents.alertSuccess, ['Done running DB checks. The latest results are displayed.']);
    }, 10000);
  };

  const toggleShowSilenced = () => {
    setShowSilenced(currentValue => !currentValue);
  };

  useEffect(() => {
    fetchAlerts();
    saveShowSilencedValue(showSilenced);
  }, [showSilenced]);

  return (
    <>
      <div className={styles.header}>
        <div className={styles.actionButtons} data-qa="db-check-panel-actions">
          <span className={styles.showAll}>
            <span data-qa="db-checks-failed-checks-toggle-silenced">
              <Switch value={showSilenced} onChange={toggleShowSilenced} />
            </span>
            <span>{Messages.showAll}</span>
          </span>
          <LoaderButton
            type="button"
            size="md"
            loading={runChecksPending}
            disabled={hasNoAccess}
            onClick={handleRunChecksClick}
            className={styles.runChecksButton}
          >
            {Messages.runDbChecks}
          </LoaderButton>
        </div>
      </div>
      <AlertsReloadContext.Provider value={{ fetchAlerts }}>
        {fetchAlertsPending ? (
          <div className={styles.spinner} data-qa="db-checks-failed-checks-spinner">
            <Spinner />
          </div>
        ) : (
          <Table data={dataSource} columns={COLUMNS} hasNoAccess={hasNoAccess} />
        )}
      </AlertsReloadContext.Provider>
    </>
  );
};
