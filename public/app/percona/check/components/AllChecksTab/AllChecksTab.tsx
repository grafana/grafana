import { LoaderButton, logger } from '@percona/platform-core';
import React, { FC, useCallback, useMemo, useState } from 'react';

import { AppEvents, UrlQueryMap } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { OldPage } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { CheckService } from 'app/percona/check/Check.service';
import { CheckDetails, Interval } from 'app/percona/check/types';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/integrated-alerting/components/Table';
import { CustomCollapsableSection } from 'app/percona/shared/components/Elements/CustomCollapsableSection/CustomCollapsableSection';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchAdvisors } from 'app/percona/shared/core/reducers/advisors/advisors';
import { getAdvisors, getCategorizedAdvisors, getPerconaSettingFlag } from 'app/percona/shared/core/selectors';
import { dispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { Messages as mainChecksMessages } from '../../CheckPanel.messages';
import { ChecksInfoAlert } from '../CheckInfoAlert/CheckInfoAlert';

import { Messages } from './AllChecksTab.messages';
import { getStyles } from './AllChecksTab.styles';
import { ChangeCheckIntervalModal } from './ChangeCheckIntervalModal';
import { CheckActions } from './CheckActions/CheckActions';

export const AllChecksTab: FC<GrafanaRouteComponentProps<{ category: string }>> = ({ match }) => {
  const category = match.params.category;
  const navModel = usePerconaNavModel(`advisors-${category}`);
  const [runChecksPending, setRunChecksPending] = useState(false);
  const [checkIntervalModalVisible, setCheckIntervalModalVisible] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<CheckDetails>();
  const styles = useStyles2(getStyles);
  const { loading: advisorsPending } = useSelector(getAdvisors);
  const categorizedAdvisors = useSelector(getCategorizedAdvisors);
  const advisors = categorizedAdvisors[category];
  const [queryParams] = useQueryParams();

  if (navModel.main.id === 'not-found') {
    locationService.push('/advisors');
  }
  const getCheckNamesListInCategory = () => {
    return Object.values(advisors)
      .map((advisor) => advisor.checks)
      .flat()
      .map((check) => check.name);
  };

  const handleRunChecksClick = async () => {
    setRunChecksPending(true);
    try {
      await CheckService.runDbChecks(getCheckNamesListInCategory());
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

  const changeCheck = useCallback(async (check: CheckDetails) => {
    const action = !!check.disabled ? 'enable' : 'disable';
    try {
      await CheckService.changeCheck({ params: [{ name: check.name, [action]: true }] });
      await dispatch(fetchAdvisors());
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
    async (check: CheckDetails) => {
      await dispatch(fetchAdvisors());
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
        noHiddenOverflow: true,
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const featureSelector = useCallback(getPerconaSettingFlag('sttEnabled'), []);

  const isFilterSet = (queryParams: UrlQueryMap, advisorName: string) => {
    return Object.keys(queryParams).includes(advisorName);
  };

  return (
    <OldPage navModel={navModel} tabsDataTestId="db-check-tabs-bar" data-testid="db-check-panel">
      <OldPage.Contents dataTestId="db-check-tab-content">
        <FeatureLoader
          messagedataTestId="db-check-panel-settings-link"
          featureName={mainChecksMessages.advisors}
          featureSelector={featureSelector}
        >
          <ChecksInfoAlert />
          <div className={styles.wrapper}>
            <div className={styles.header}>
              <h1>{Messages.availableHeader}</h1>
              <div className={styles.actionButtons} data-testid="db-check-panel-actions">
                <LoaderButton
                  type="button"
                  variant="secondary"
                  size="md"
                  loading={runChecksPending}
                  onClick={handleRunChecksClick}
                  className={styles.runChecksButton}
                >
                  {Messages.runDbChecks}
                </LoaderButton>
              </div>
            </div>
            {advisors &&
              Object.keys(advisors).map((summary) => (
                <CustomCollapsableSection
                  key={summary}
                  mainLabel={summary}
                  content={advisors[summary].description}
                  sideLabel={advisors[summary].comment}
                  isInitOpen={isFilterSet(queryParams, advisors[summary].name)}
                >
                  <Table
                    totalItems={advisors[summary].checks.length}
                    data={advisors[summary].checks}
                    columns={columns}
                    pendingRequest={advisorsPending}
                    emptyMessage={Messages.table.noData}
                    tableKey={advisors[summary].name}
                    showFilter
                  />
                  {!!selectedCheck && checkIntervalModalVisible && (
                    <ChangeCheckIntervalModal
                      check={selectedCheck}
                      onClose={handleModalClose}
                      onIntervalChanged={handleIntervalChanged}
                    />
                  )}
                </CustomCollapsableSection>
              ))}

            {/* Uncomment and set when api for upgradable plans is ready */}
            {/* <UpgradePlanWrapper label="Standart plan" buttonLabel="See plan details" buttonOnClick={() => {}}>
              <CustomCollapsableSection
                mainLabel="CVE security"
                content="Imforming users about versions of DBs affected by CVE."
                sideLabel="Partion support (Mongo)"
              />
              <CustomCollapsableSection
                mainLabel="CVE security"
                content="Imforming users about versions of DBs affected by CVE."
                sideLabel="Partion support (Mongo)"
              />
            </UpgradePlanWrapper> */}
          </div>
        </FeatureLoader>
      </OldPage.Contents>
    </OldPage>
  );
};

export default AllChecksTab;
