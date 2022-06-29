import React, { FC, useEffect, useState, useCallback, useMemo } from 'react';
import { useStyles2 } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { LoaderButton, logger } from '@percona/platform-core';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/integrated-alerting/components/Table';
import { CheckDetails, Interval } from 'app/percona/check/types';
import { CheckService } from 'app/percona/check/Check.service';
import { GET_ALL_CHECKS_CANCEL_TOKEN } from './AllChecksTab.constants';
import { Messages } from './AllChecksTab.messages';
import { Messages as mainChecksMessages } from '../../CheckPanel.messages';
import { FetchChecks } from './types';
import { CheckActions } from './CheckActions/CheckActions';
import { ChangeCheckIntervalModal } from './ChangeCheckIntervalModal';
import { getStyles } from './AllChecksTab.styles';
import { appEvents } from '../../../../core/app_events';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import Page from 'app/core/components/Page/Page';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { getPerconaSettingFlag } from 'app/percona/shared/core/selectors';

//TODO uncomment for 2.29.0
// interface FormValues {
//   categories: string[];
//   name: string;
//   status: string;
//   interval: string;
//   description: string;
// }

export const AllChecksTab: FC = () => {
  // const [queryParams, setQueryParams] = useQueryParams();
  const [fetchChecksPending, setFetchChecksPending] = useState(false);
  const navModel = usePerconaNavModel('all-checks');
  const [generateToken] = useCancelToken();
  const [runChecksPending, setRunChecksPending] = useState(false);
  const [checkIntervalModalVisible, setCheckIntervalModalVisible] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<CheckDetails>();
  const [checks, setChecks] = useState<CheckDetails[]>([]);
  const styles = useStyles2(getStyles);
  // const categories = useMemo<string[]>(
  //   () => getValuesFromQueryParams<[string[]]>(queryParams, [{ key: 'category' }])[0],
  //   [queryParams]
  // );

  // const Filters = withFilterTypes<FormValues>({
  //   categories,
  //   name: '*',
  //   status: 'all',
  //   interval: 'all',
  //   description: '*',
  // });

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

  // const applyFilters = ({ categories }: FormValues) => setQueryParams({ category: categories });

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
      // {
      //   Header: Messages.table.columns.category,
      //   accessor: 'category',
      // },
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
          {/* <Filters onApply={applyFilters}>
            <ChipAreaInputField
              tooltipText={Messages.tooltips.category}
              name="categories"
              label={Messages.table.columns.category}
              initialChips={categories || []}
              isEqual={sameTags}
            />
            <TextInputField
              name="name"
              label={Messages.table.columns.name}
              disabled
              tooltipText={Messages.tooltips.availableSoon}
            />
            <RadioButtonGroupField
              tooltipText={Messages.tooltips.availableSoon}
              fullWidth
              options={STATUS_OPTIONS}
              name="status"
              disabled
              label={Messages.table.columns.status}
            />
            <RadioButtonGroupField
              tooltipText={Messages.tooltips.availableSoon}
              fullWidth
              options={INTERVAL_OPTIONS}
              name="interval"
              disabled
              label={Messages.table.columns.interval}
            />
            <TextInputField
              tooltipText={Messages.tooltips.availableSoon}
              fieldClassName={styles.descriptionFilter}
              name="description"
              label={Messages.table.columns.description}
              disabled
            />
          </Filters> */}
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
