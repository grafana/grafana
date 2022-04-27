import React, { FC, useEffect, useState, useCallback } from 'react';
import { cx } from '@emotion/css';
import { LoaderButton, logger } from '@percona/platform-core';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { CheckDetails } from 'app/percona/check/types';
import { CheckService } from 'app/percona/check/Check.service';
import { Spinner, useStyles2 } from '@grafana/ui';
import { getStyles as getCheckPanelStyles } from 'app/percona/check/CheckPanel.styles';
import { getStyles as getMainStyles } from './AllChecksTab.styles';
import { Messages } from './AllChecksTab.messages';
import { GET_ALL_CHECKS_CANCEL_TOKEN } from './AllChecksTab.constants';
import { FetchChecks } from './types';
import { CheckTableRow } from './CheckTableRow';
import { ChecksReloadContext } from './AllChecks.context';
import { appEvents } from '../../../../core/app_events';
import { AppEvents } from '@grafana/data';

export const AllChecksTab: FC = () => {
  const [fetchChecksPending, setFetchChecksPending] = useState(false);
  const [checks, setChecks] = useState<CheckDetails[] | undefined>();
  const mainStyles = useStyles2(getMainStyles);
  const checkPanelStyles = useStyles2(getCheckPanelStyles);
  const [generateToken] = useCancelToken();
  const [runChecksPending, setRunChecksPending] = useState(false);

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

  const updateUI = (check: CheckDetails) => {
    const { name, disabled } = check;

    setChecks((oldChecks) =>
      oldChecks?.map((oldCheck) => {
        if (oldCheck.name !== name) {
          return oldCheck;
        }

        return { ...oldCheck, disabled };
      })
    );
  };

  const fetchChecks: FetchChecks = useCallback(async () => {
    setFetchChecksPending(true);

    try {
      const checks = await CheckService.getAllChecks(generateToken(GET_ALL_CHECKS_CANCEL_TOKEN));

      setChecks(checks);
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    setFetchChecksPending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className={mainStyles.header}>
        <div className={mainStyles.actionButtons} data-testid="db-check-panel-actions">
          <LoaderButton
            type="button"
            size="md"
            loading={runChecksPending}
            onClick={handleRunChecksClick}
            className={mainStyles.runChecksButton}
          >
            {Messages.runDbChecks}
          </LoaderButton>
        </div>
      </div>
      <div className={cx(mainStyles.tableWrapper, mainStyles.wrapper)} data-testid="db-checks-all-checks-wrapper">
        {fetchChecksPending ? (
          <div className={checkPanelStyles.spinner} data-testid="db-checks-all-checks-spinner">
            <Spinner />
          </div>
        ) : (
          <table className={mainStyles.table} data-testid="db-checks-all-checks-table">
            <colgroup>
              <col className={mainStyles.nameColumn} />
              <col />
              <col className={mainStyles.statusColumn} />
              <col className={mainStyles.intervalColumn} />
              <col className={mainStyles.actionsColumn} />
            </colgroup>
            <thead data-testid="db-checks-all-checks-thead">
              <tr>
                <th>{Messages.name}</th>
                <th>{Messages.description}</th>
                <th>{Messages.status}</th>
                <th>{Messages.interval}</th>
                <th>{Messages.actions}</th>
              </tr>
            </thead>
            <tbody data-testid="db-checks-all-checks-tbody">
              <ChecksReloadContext.Provider value={{ fetchChecks }}>
                {checks
                  ?.sort((a, b) => a.summary.localeCompare(b.summary))
                  .map((check) => (
                    <CheckTableRow key={check.name} check={check} onSuccess={updateUI} />
                  ))}
              </ChecksReloadContext.Provider>
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};
