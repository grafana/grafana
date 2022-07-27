import { LoaderButton, logger } from '@percona/platform-core';
import React, { FC, useEffect, useState, useCallback, useMemo } from 'react';

import { AppEvents } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import Page from 'app/core/components/Page/Page';
import { CheckService } from 'app/percona/check/Check.service';
import { CheckDetails, Interval } from 'app/percona/check/types';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/integrated-alerting/components/Table';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';

import { Messages as mainChecksMessages } from '../../CheckPanel.messages';

import { GET_ALL_CHECKS_CANCEL_TOKEN } from './AllChecksTab.constants';
import { Messages } from './AllChecksTab.messages';
import { getStyles } from './AllChecksTab.styles';
import { ChangeCheckIntervalModal } from './ChangeCheckIntervalModal';
import { CheckActions } from './CheckActions/CheckActions';
import { FetchChecks } from './types';

export const AllChecksTab: FC = () => {
  const [fetchChecksPending, setFetchChecksPending] = useState(false);
  const navModel = usePerconaNavModel('all-checks');
  const [generateToken] = useCancelToken();
  const [runChecksPending, setRunChecksPending] = useState(false);
  const [checkIntervalModalVisible, setCheckIntervalModalVisible] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<CheckDetails>();
  const [checks, setChecks] = useState<CheckDetails[]>([]);
  const styles = useStyles2(getStyles);

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

  const runIndividualCheck = async (check: CheckDetails) => {
    try {
      await CheckService.runIndividualDbCheck(check.name);
      appEvents.emit(AppEvents.alertSuccess, [`${check.summary} ${Messages.runIndividualDbCheck}`]);
    } catch (e) {
      logger.error(e);
    } finally {
    }
  };

  const updateUI = (check: CheckDetails) => {
    const { name, disabled, interval } = check;

    setChecks((oldChecks) =>
      oldChecks.map((oldCheck) => {
        if (oldCheck.name !== name) {
          return oldCheck;
        }

        return { ...oldCheck, disabled, interval };
      })
    );
  };

  const changeCheck = useCallback(async (check: CheckDetails) => {
    const action = !!check.disabled ? 'enable' : 'disable';
    try {
      await CheckService.changeCheck({ params: [{ name: check.name, [action]: true }] });
      updateUI({ ...check, disabled: !check.disabled });
    } catch (e) {
      logger.error(e);
    }
  }, []);

  const handleIntervalChangeClick = useCallback((check: CheckDetails) => {
    setSelectedCheck(check);
    setCheckIntervalModalVisible(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setCheckIntervalModalVisible(false);
    setSelectedCheck(undefined);
  }, []);

  const handleIntervalChanged = useCallback(
    (check: CheckDetails) => {
      updateUI({ ...check });
      handleModalClose();
    },
    [handleModalClose]
  );

  const columns = useMemo(
    (): Array<ExtendedColumn<CheckDetails>> => [
      {
        Header: Messages.table.columns.name,
        accessor: 'summary',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.table.columns.description,
        accessor: 'description',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.table.columns.status,
        accessor: 'disabled',
        Cell: ({ value }) => (!!value ? Messages.disabled : Messages.enabled),
        type: FilterFieldTypes.RADIO_BUTTON,
        options: [
          {
            label: Messages.enabled,
            value: false,
          },
          {
            label: Messages.disabled,
            value: true,
          },
        ],
      },
      {
        Header: Messages.table.columns.interval,
        accessor: 'interval',
        Cell: ({ value }) => Interval[value],
        type: FilterFieldTypes.DROPDOWN,
        options: [
          {
            label: Interval.STANDARD,
            value: Interval.STANDARD,
          },
          {
            label: Interval.RARE,
            value: Interval.RARE,
          },
          {
            label: Interval.FREQUENT,
            value: Interval.FREQUENT,
          },
        ],
      },
      {
        Header: Messages.table.columns.actions,
        accessor: 'name',
        id: 'actions',
        // eslint-disable-next-line react/display-name
        Cell: ({ row }) => (
          <CheckActions
            check={row.original}
            onChangeCheck={changeCheck}
            onIntervalChangeClick={handleIntervalChangeClick}
            onIndividualRunCheckClick={runIndividualCheck}
          />
        ),
      },
    ],
    [changeCheck, handleIntervalChangeClick]
  );

  useEffect(() => {
    const fetchChecks: FetchChecks = async () => {
      setFetchChecksPending(true);
      try {
        const checks = await CheckService.getAllChecks(generateToken(GET_ALL_CHECKS_CANCEL_TOKEN));

        setChecks(checks.map((check) => (!!check.disabled ? check : { ...check, disabled: false })));
      } catch (e) {
        if (isApiCancelError(e)) {
          return;
        }
        logger.error(e);
      }
      setFetchChecksPending(false);
    };
    fetchChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('sttEnabled'), []);

  return (
    <Page navModel={navModel} tabsDataTestId="db-check-tabs-bar" data-testid="db-check-panel">
      <Page.Contents dataTestId="db-check-tab-content">
        <FeatureLoader
          messagedataTestId="db-check-panel-settings-link"
          featureName={mainChecksMessages.advisors}
          featureSelector={featureSelector}
        >
          <div className={styles.actionButtons} data-testid="db-check-panel-actions">
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
          <Table
            totalItems={checks.length}
            data={checks}
            columns={columns}
            pendingRequest={fetchChecksPending}
            emptyMessage={Messages.table.noData}
            showFilter
          />
          {!!selectedCheck && checkIntervalModalVisible && (
            <ChangeCheckIntervalModal
              check={selectedCheck}
              onClose={handleModalClose}
              onIntervalChanged={handleIntervalChanged}
            />
          )}
        </FeatureLoader>
      </Page.Contents>
    </Page>
  );
};

export default AllChecksTab;
