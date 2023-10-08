import { css, cx } from '@emotion/css';
import uFuzzy from '@leeoniya/ufuzzy';
import { createSelector } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import pluralize from 'pluralize';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Stack } from '@grafana/experimental';
import { locationService } from '@grafana/runtime';
import {
  Alert,
  Badge,
  Button,
  CallToActionCard,
  ConfirmModal,
  FilterInput,
  HorizontalGroup,
  Icon,
  Link,
  Tab,
  TabContent,
  TabsBar,
  TagList,
  Text,
  TextLink,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import PageLoader from '../../core/components/PageLoader/PageLoader';
import { MatcherOperator } from '../../plugins/datasource/alertmanager/types';
import { getSearchPlaceholder } from '../search/tempI18nPhrases';

import { CollapsableAlert } from './components/CollapsableAlert';
import { AlertPair, ContactPair, DashboardUpgrade, OrgMigrationState, upgradeApi } from './unified/api/upgradeApi';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from './unified/components/DynamicTable';
import { DynamicTableWithGuidelines } from './unified/components/DynamicTableWithGuidelines';
import { Matchers } from './unified/components/notification-policies/Matchers';
import { ActionIcon } from './unified/components/rules/ActionIcon';
import { createContactPointLink, makeDashboardLink, makeFolderLink } from './unified/utils/misc';
import { createUrl } from './unified/utils/url';

export const UpgradePage = () => {
  const { useGetOrgUpgradeSummaryQuery } = upgradeApi;
  const {
    currentData: summary,
    isFetching: isFetching,
    isError: isFetchError,
    error: fetchError,
  } = useGetOrgUpgradeSummaryQuery();

  const alertCount = (summary?.migratedDashboards ?? []).reduce(
    (acc, cur) => acc + (cur?.migratedAlerts?.length ?? 0),
    0
  );
  const contactCount = summary?.migratedChannels?.length ?? 0;

  const errors = summary?.errors ?? [];
  const hasData = alertCount > 0 || contactCount > 0 || errors.length > 0;

  const cancelUpgrade = useMemo(() => {
    if (!isFetchError && hasData) {
      return <CancelUpgradeButton />;
    }
    return null;
  }, [isFetchError, hasData]);

  return (
    <Page navId="alerting-upgrade" actions={cancelUpgrade}>
      <Page.Contents>
        {isFetchError && (
          <Alert severity="error" title="Error loading Grafana Alerting upgrade information">
            {fetchError instanceof Error ? fetchError.message : 'Unknown error.'}
          </Alert>
        )}
        {!isFetchError && !isFetching && !hasData && <CTAElement />}
        {!isFetchError && hasData && (
          <>
            <ErrorSummary errors={errors} />
            <UpgradeTabs alertCount={alertCount} contactCount={contactCount} />
          </>
        )}
      </Page.Contents>
    </Page>
  );
};

interface UpgradeTabsProps {
  alertCount: number;
  contactCount: number;
}

export const UpgradeTabs = ({ alertCount, contactCount }: UpgradeTabsProps) => {
  const styles = useStyles2(getStyles);

  const [queryParams, setQueryParams] = useQueryParams();
  const { tab } = getActiveTabFromUrl(queryParams);

  const [activeTab, setActiveTab] = useState<ActiveTab>(tab);

  return (
    <>
      <CollapsableAlert
        localStoreKey={'grafana.unifiedalerting.upgrade.guideNotice'}
        alertTitle={'Grafana Alerting upgrade guide'}
        collapseText={'Upgrade guide'}
        collapseTooltip={'Show upgrade guide'}
        severity={'info'}
        collapseJustify={'flex-start'}
      >
        <p>
          Preview of how your existing alert rules and notification channels wll be upgraded to the new Grafana
          Alerting.
          <br />
          Once you are happy with the results, you can permanently upgrade by modifying the Grafana configuration.
        </p>
        <p>
          {'For more information, please refer to the '}
          <TextLink external href={'https://grafana.com/docs/grafana/latest/alerting/set-up/migrating-alerts/'}>
            Grafana Alerting Migration Guide
          </TextLink>
        </p>
      </CollapsableAlert>
      <TabsBar>
        <Tab
          label={'Upgraded alert rules'}
          active={activeTab === ActiveTab.Alerts}
          counter={alertCount}
          icon={'bell'}
          onChangeTab={() => {
            setActiveTab(ActiveTab.Alerts);
            setQueryParams({ tab: ActiveTab.Alerts });
          }}
        />
        <Tab
          label={'Upgraded notification channels'}
          active={activeTab === ActiveTab.Contacts}
          counter={contactCount}
          icon={'at'}
          onChangeTab={() => {
            setActiveTab(ActiveTab.Contacts);
            setQueryParams({ tab: ActiveTab.Contacts });
          }}
        />
      </TabsBar>
      <TabContent className={styles.tabContent}>
        <>
          {activeTab === ActiveTab.Alerts && <AlertTabContentWrapper />}
          {activeTab === ActiveTab.Contacts && <ChannelTabContentWrapper />}
        </>
      </TabContent>
    </>
  );
};

const CancelUpgradeButton = () => {
  const styles = useStyles2(getStyles);
  const [startOver] = upgradeApi.useCancelOrgUpgradeMutation();
  const [showConfirmStartOver, setShowConfirmStartOver] = useState(false);

  const cancelUpgrade = async () => {
    await startOver();
    setShowConfirmStartOver(false);
  };

  return (
    <>
      <Button
        size="md"
        variant="destructive"
        onClick={() => setShowConfirmStartOver(true)}
        icon={'trash-alt'}
        className={''}
      >
        {'Cancel upgrade'}
      </Button>
      {showConfirmStartOver && (
        <ConfirmModal
          isOpen={true}
          title="Cancel upgrade"
          body={
            <Stack direction="column" gap={0.5}>
              <Text color="primary">All new Grafana Alerting resources will be deleted.</Text>
              <Text color="secondary" variant="bodySmall">
                This includes: alert rules, contact points, notification policies, silences, mute timings, and any
                manual changes you have made.
              </Text>
              <span className={styles.separator} />
              <Text color="primary">No legacy alerts or notification channels will be affected.</Text>
            </Stack>
          }
          confirmText="Cancel upgrade"
          onConfirm={cancelUpgrade}
          dismissText={'Keep reviewing'}
          onDismiss={() => setShowConfirmStartOver(false)}
        />
      )}
    </>
  );
};

enum ActiveTab {
  Alerts = 'alerts',
  Contacts = 'contacts',
}

interface QueryParamValues {
  tab: ActiveTab;
}

function getActiveTabFromUrl(queryParams: UrlQueryMap): QueryParamValues {
  let tab = ActiveTab.Alerts; // default tab

  if (queryParams['tab'] === ActiveTab.Alerts) {
    tab = ActiveTab.Alerts;
  }

  if (queryParams['tab'] === ActiveTab.Contacts) {
    tab = ActiveTab.Contacts;
  }

  return {
    tab,
  };
}

const CTAElement = () => {
  const styles = useStyles2(getContentBoxStyles);
  const { useUpgradeOrgMutation } = upgradeApi;
  const [startUpgrade, { isLoading }] = useUpgradeOrgMutation();

  const upgradeAlerting = async () => {
    await startUpgrade({ skipExisting: false });
  };

  if (isLoading) {
    return <PageLoader />;
  }

  const footer = (
    <>
      <span key="proTipFooter">
        <p>
          Note:{' '}
          {'Previewing the upgrade process will not affect your existing legacy alerts and can be stopped at any time.'}
        </p>
      </span>
    </>
  );

  const cta = (
    <div>
      <Stack direction="column" gap={1}>
        <Stack direction="row" gap={1}>
          <Button
            size="lg"
            variant="primary"
            onClick={upgradeAlerting}
            icon={'bell'}
            className={''}
            data-testid={selectors.components.CallToActionCard.buttonV2('Preview upgrade')}
          >
            {'Preview upgrade'}
          </Button>
        </Stack>
      </Stack>
    </div>
  );

  return (
    <div className={styles.grid}>
      <ContentBox className={styles.processBlock}>
        <h3 className={styles.header}>How it works</h3>
        <Stack direction="column" alignItems="space-between">
          <div className={styles.list}>
            <h4>Automatic Upgrade</h4>
            <div className={styles.step}>
              <p>
                The upgrade process seamlessly transfers your existing legacy alert rules and notification channels to
                the new Grafana Alerting system. This means your alerting configurations are preserved during the
                transition.
              </p>
            </div>
            <h4>Preview and Modification</h4>
            <div className={styles.step}>
              <p>
                Alert Rules, Contact Points, and Notification Policies generated during the upgrade are available for
                your review and potential adjustments. However, please note that they won't actively trigger alerts or
                send notifications at this stage.
              </p>
            </div>
            <h4>Limitations on Real-Time Updates</h4>
            <div className={styles.step}>
              <p>
                Any changes made to your configurations after initiating the upgrade won't be immediately reflected in
                the summary table. You have the flexibility to re-upgrade specific resources like dashboards, alert
                rules, and notification channels at any time.
              </p>
            </div>
            <h4>Cancellation and Restart</h4>
            <div className={styles.step}>
              <p>
                If necessary, you can cancel and restart the upgrade process. However, it's important to be aware that
                canceling the upgrade will result in the removal of all Grafana Alerting resources, including any manual
                modifications you've made during the process.
              </p>
            </div>
            <h4>Completing the Upgrade</h4>
            <div className={styles.step}>
              <p>
                To enable Grafana Alerting, you'll need to modify the Grafana configuration and restart. Until this step
                is completed, Grafana Alerting will remain inactive.
              </p>
            </div>
          </div>
        </Stack>
      </ContentBox>
      <ContentBox className={styles.getStartedBlock}>
        <h3 className={styles.header}>Get started</h3>
        <Stack direction="column" alignItems="space-between">
          <div className={styles.list}>
            <h4>Step 1: Preview the Upgrade</h4>
            <div className={styles.step}>
              <p>
                Start the upgrade process by clicking on "Preview upgrade." This action will display a summary table
                showing how your existing alert rules and notification channels will be mapped to resources in the new
                Grafana Alerting system.
              </p>
            </div>
            <h4>Step 2: Investigate and Resolve Errors</h4>
            <div className={styles.step}>
              <p>
                Review the previewed upgrade carefully. Alert rules or notification channels that couldn't be
                automatically upgraded will be marked as errors. You have two options to address these errors:
              </p>
              <ul className={styles.list}>
                <li>
                  Fix the issues on the legacy side: If possible, resolve the problems within your legacy alerting
                  setup, and then attempt the upgrade again.
                </li>
                <li>
                  Manually create new resources: If fixing legacy issues isn't feasible, manually create new alert
                  rules, notification policies, or contact points in the new Grafana Alerting system to replace the
                  problematic ones.
                </li>
              </ul>
            </div>
            <h4>Step 3: Update Your As-Code Setup (Optional)</h4>
            <div className={styles.step}>
              <p>
                In the new Grafana Alerting, Legacy Alerting methods of provisioning will no longer work. If you use
                provisioning to manage alert rules and notification channels, you can export the upgraded versions to
                generate Grafana Alerting-compatible provisioning files. This can all be done before completeing the
                upgrade process.
              </p>
            </div>
            <h4>Step 4: Perform the Upgrade to Grafana Alerting</h4>
            <div className={styles.step}>
              <p>
                Once you are satisfied with the state of your Grafana Alerting setup, it's time to proceed with the
                upgrade:
              </p>
              <ul className={styles.list}>
                <li>
                  Contact your Grafana server administrator to restart Grafana with the [unified_alerting] section
                  enabled in your configuration.
                </li>
                <li>
                  During this process, all organizations that have undergone the above upgrade process will continue to
                  use their configured setup.
                </li>
                <li>
                  Any organization that has not yet started the upgrade process will be automatically upgraded as part
                  of this restart.
                </li>
                <li>
                  Note: If the automatic upgrade fails for any reason, Grafana will not start, so it's safer to address
                  any issues before initiating this step.
                </li>
              </ul>
            </div>
          </div>
          <Stack direction={'row'} alignItems={'center'} gap={0.5}>
            <Text color={'secondary'}>For more information, please refer to the</Text>
            <TextLink external href={'https://grafana.com/docs/grafana/latest/alerting/set-up/migrating-alerts/'}>
              Grafana Alerting Migration Guide
            </TextLink>
          </Stack>
        </Stack>
      </ContentBox>
      <ContentBox className={styles.ctaBlock}>
        <CallToActionCard
          className={styles.ctaStyle}
          message={'Start the upgrade to the new Grafana Alerting.'}
          footer={footer}
          callToActionElement={cta}
        />
      </ContentBox>
    </div>
  );
};

function ContentBox({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  const styles = useStyles2(getContentBoxStyles);

  return <div className={cx(styles.box, className)}>{children}</div>;
}

const getContentBoxStyles = (theme: GrafanaTheme2) => {
  const color = theme.colors['warning'];
  return {
    box: css`
      padding: ${theme.spacing(2)};
      background-color: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default};
    `,
    warningIcon: css`
      color: ${color.text};
    `,
    grid: css`
      display: grid;
      grid-template-rows: min-content auto auto;
      grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
      gap: ${theme.spacing(2)};
    `,
    list: css`
      margin: ${theme.spacing(0, 2)};
      & > li {
        margin-bottom: ${theme.spacing(1)};
      }
    `,
    ctaStyle: css`
      text-align: center;
    `,
    processBlock: css`
      grid-column: 1 / span 2;
      justify-content: space-between;
    `,
    getStartedBlock: css`
      grid-column: 3 / span 3;
      justify-content: space-between;
    `,
    ctaBlock: css`
      grid-column: 1 / span 5;
    `,
    header: css`
      margin-bottom: ${theme.spacing(2)};
    `,
    step: css`
      padding-left: ${theme.spacing(2)};
    `,
  };
};

const AlertTabContentWrapper = () => {
  const columns = useAlertColumns();
  const filterParam = 'alertFilter';
  const [queryParam] = useSingleQueryParam(filterParam);

  const [startAlertUpgrade, { isLoading }] = upgradeApi.useUpgradeAllDashboardsMutation();

  const syncAlerting = async () => {
    await startAlertUpgrade({ skipExisting: true });
  };

  const selectRows = useMemo(() => {
    const emptyArray: Array<DynamicTableItemProps<DashboardUpgrade>> = [];
    return createSelector(
      (res: OrgMigrationState | undefined) => res?.migratedDashboards ?? [],
      (rows) => rows ?? emptyArray
    );
  }, []);

  const { items } = upgradeApi.useGetOrgUpgradeSummaryQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: selectRows(data),
    }),
  });

  const searchSpaceMap = useCallback(
    (dashUpgrade: DashboardUpgrade) =>
      `${dashUpgrade.folderName} ${dashUpgrade.dashboardName} ${dashUpgrade.newFolderName}`,
    []
  );
  const renderExpandedContent = useCallback(
    ({ data: dashUpgrade }: { data: DashboardUpgrade }) => (
      <AlertTable
        dashboardUid={dashUpgrade.dashboardUid ?? ''}
        dashboardId={dashUpgrade.dashboardId}
        showGuidelines={true}
      />
    ),
    []
  );

  return (
    <AlertTabContent
      rows={items}
      queryParam={queryParam}
      filterParam={filterParam}
      searchSpaceMap={searchSpaceMap}
      searchPlaceholder={getSearchPlaceholder(false)}
      onSync={syncAlerting}
      syncText={'Upgrade New Alerts'}
      syncTooltip={'Upgrade all newly created legacy alerts since the previous run.'}
      isLoading={isLoading}
      emptyMessage={'No alert upgrades found.'}
      columns={columns}
      isExpandable={true}
      renderExpandedContent={renderExpandedContent}
    />
  );
};
AlertTabContentWrapper.displayName = 'AlertTabContentWrapper';

const ChannelTabContentWrapper = () => {
  const columns = useChannelColumns();

  const filterParam = 'contactFilter';
  const [queryParam] = useSingleQueryParam(filterParam);

  const [startChannelUpgrade, { isLoading }] = upgradeApi.useUpgradeAllChannelsMutation();

  const syncAlerting = async () => {
    await startChannelUpgrade({ skipExisting: true });
  };

  const selectRows = useMemo(() => {
    const emptyArray: Array<DynamicTableItemProps<ContactPair>> = [];
    return createSelector(
      (res: OrgMigrationState | undefined) => res?.migratedChannels ?? [],
      (rows) => rows ?? emptyArray
    );
  }, []);

  const { items } = upgradeApi.useGetOrgUpgradeSummaryQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: selectRows(data),
    }),
  });

  const searchSpaceMap = useCallback(
    (pair: ContactPair) => `${pair.legacyChannel?.name} ${pair.contactPoint?.name} ${pair.legacyChannel?.type}`,
    []
  );

  return (
    <ChannelTabContent
      rows={items}
      queryParam={queryParam}
      filterParam={filterParam}
      searchSpaceMap={searchSpaceMap}
      searchPlaceholder={'Search for channel and contact point names'}
      onSync={syncAlerting}
      syncText={'Upgrade New Channels'}
      syncTooltip={'Upgrade all newly created legacy notification channels since the previous run.'}
      isLoading={isLoading}
      emptyMessage={'No channel upgrades found.'}
      columns={columns}
    />
  );
};
ChannelTabContentWrapper.displayName = 'ChannelTabContentWrapper';

function useSingleQueryParam(name: string): [string | undefined, (values: string) => void] {
  const { search } = useLocation();
  const param = useMemo(() => {
    return new URLSearchParams(search).get(name) || '';
  }, [name, search]);
  // const param = useMemo(() => queryParams[name] === undefined ? undefined : String(queryParams[name]), [queryParams, name]);
  const update = useCallback(
    (value: string) => {
      return locationService.partial({ [name]: value || null });
    },
    [name]
  );
  return [param, update];
}

interface UpgradeTabContentProps<T extends object> {
  rows?: T[];
  queryParam?: string;
  filterParam: string;
  searchSpaceMap: (row: T) => string;
  searchPlaceholder: string;
  onSync: () => void;
  syncText: string;
  syncTooltip: string;
  isLoading: boolean;
  columns: Array<DynamicTableColumnProps<T>>;
  isExpandable?: boolean;
  renderExpandedContent?: (item: DynamicTableItemProps<T>) => React.ReactNode;
  emptyMessage: string;
}

const UpgradeTabContent = <T extends object>({
  rows = [],
  filterParam,
  queryParam,
  searchSpaceMap,
  columns,
  isExpandable = false,
  renderExpandedContent,
  emptyMessage,
  searchPlaceholder,
  onSync,
  syncText,
  syncTooltip,
  isLoading,
}: UpgradeTabContentProps<T>) => {
  const styles = useStyles2(getStyles);

  const [filter, setFilter] = useState(queryParam || '');

  const filterFn = useMemo(() => {
    return createfilterByMapping<T>(searchSpaceMap);
  }, [searchSpaceMap]);

  const items = useMemo((): Array<DynamicTableItemProps<T>> => {
    return filterFn(rows, filter).map((row, Idx) => {
      return {
        id: `${searchSpaceMap(row)} - ${Idx}`,
        data: row,
      };
    });
  }, [searchSpaceMap, filterFn, rows, filter]);

  const showGuidelines = false;
  const wrapperClass = cx(styles.wrapper, { [styles.wrapperMargin]: showGuidelines });

  const TableComponent = showGuidelines ? DynamicTableWithGuidelines : DynamicTable;

  const pagination = useMemo(() => ({ itemsPerPage: 10 }), []);

  return (
    <>
      <div className={styles.searchWrapper}>
        <Stack direction="column" gap={1}>
          <Stack direction="row" gap={1}>
            <Search
              placeholder={searchPlaceholder}
              searchFn={(phrase) => {
                setFilter(phrase || '');
                locationService.partial({ [filterParam]: phrase || null });
              }}
              searchPhrase={filter || ''}
            />
            <Tooltip theme="info-alt" content={syncTooltip} placement="top">
              <Button size="md" variant="secondary" onClick={onSync} icon={'plus-circle'}>
                {syncText}
              </Button>
            </Tooltip>
          </Stack>
        </Stack>
      </div>
      {isLoading && <PageLoader />}
      {!isLoading && !!items.length && (
        <div className={wrapperClass}>
          <TableComponent
            cols={columns}
            isExpandable={isExpandable}
            items={items}
            renderExpandedContent={renderExpandedContent}
            pagination={pagination}
            paginationStyles={styles.pagination}
          />
        </div>
      )}
      {!isLoading && !items.length && <div className={cx(wrapperClass, styles.emptyMessage)}>{emptyMessage}</div>}
    </>
  );
};

const ChannelTabContent = React.memo(UpgradeTabContent<ContactPair>);
const AlertTabContent = React.memo(UpgradeTabContent<DashboardUpgrade>);

const useChannelColumns = (): Array<DynamicTableColumnProps<ContactPair>> => {
  const styles = useStyles2(getStyles);

  const { useUpgradeChannelMutation } = upgradeApi;
  const [migrateChannel] = useUpgradeChannelMutation();

  return useMemo(
    () => [
      {
        id: 'legacyChannel',
        label: 'Legacy Channel',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: contactPair }) => {
          if (!contactPair?.legacyChannel) {
            return null;
          }
          return (
            <Stack direction={'row'} gap={1}>
              <Link
                rel="noreferrer"
                target="_blank"
                className={styles.textLink}
                href={createUrl(
                  `/alerting-legacy/notifications/receivers/${encodeURIComponent(contactPair.legacyChannel.id)}/edit`,
                  {}
                )}
              >
                {contactPair.legacyChannel.name}
              </Link>
              {contactPair.legacyChannel?.type && <Badge color="blue" text={contactPair.legacyChannel.type} />}
            </Stack>
          );
        },
        size: 5,
      },
      {
        id: 'arrow',
        label: '',
        renderCell: ({ data: contactPair }) => {
          if (!contactPair?.contactPoint) {
            return null;
          }
          return <Icon name="arrow-right" />;
        },
        size: '45px',
      },
      {
        id: 'route',
        label: 'Notification Policy',
        renderCell: ({ data: contactPair }) => {
          return (
            <>
              {contactPair?.contactPoint?.routeLabel && (
                <Matchers matchers={[[contactPair.contactPoint.routeLabel, MatcherOperator.equal, 'true']]} />
              )}
            </>
          );
        },
        size: 5,
      },
      {
        id: 'arrow2',
        label: '',
        renderCell: ({ data: contactPair }) => {
          if (!contactPair?.contactPoint) {
            return null;
          }
          return <Icon name="arrow-right" />;
        },
        size: '45px',
      },
      {
        id: 'contactPoint',
        label: 'Contact Point',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: contactPair }) => {
          return (
            <Stack direction={'row'} gap={1}>
              {contactPair?.contactPoint && (
                <>
                  <Link
                    rel="noreferrer"
                    target="_blank"
                    className={styles.textLink}
                    href={createContactPointLink(contactPair.contactPoint.name, 'grafana')}
                  >
                    {contactPair.contactPoint.name}
                  </Link>
                  <Badge color="blue" text={contactPair.contactPoint.type} />
                </>
              )}
              {contactPair.error && (
                <Tooltip theme="error" content={contactPair.error}>
                  <Icon name="exclamation-circle" className={styles.errorIcon} size={'lg'} />
                </Tooltip>
              )}
            </Stack>
          );
        },
        size: 5,
      },
      {
        id: 'provisioned',
        label: '',
        renderCell: ({ data: contactPair }) => {
          return contactPair.provisioned ? (
            <Badge color="purple" text={'Provisioned'} className={styles.badge} />
          ) : null;
        },
        size: '100px',
      },
      {
        id: 'actions',
        label: 'Actions',
        renderCell: ({ data: pair }) => {
          if (!pair?.legacyChannel) {
            return null;
          }
          if (pair.legacyChannel.id <= 0) {
            return null;
          }
          return (
            <Stack gap={0.5} alignItems="center">
              <ActionIcon
                aria-label="re-upgrade legacy notification channel"
                key="upgrade-channel"
                icon="sync"
                tooltip="re-upgrade legacy notification channel"
                onClick={() => migrateChannel({ channelId: pair.legacyChannel.id, skipExisting: false })}
              />
            </Stack>
          );
        },
        size: '70px',
      },
    ],
    [styles.textLink, styles.errorIcon, styles.badge, migrateChannel]
  );
};

const useAlertColumns = (): Array<DynamicTableColumnProps<DashboardUpgrade>> => {
  const styles = useStyles2(getStyles);

  const { useUpgradeDashboardMutation } = upgradeApi;
  const [migrateDashboard] = useUpgradeDashboardMutation();

  return useMemo(
    () => [
      {
        id: 'dashboard-level-error',
        label: '',
        renderCell: ({ data: dashUpgrade }) => {
          const error = (dashUpgrade.errors ?? []).join('\n');
          if (!error) {
            return null;
          }
          return (
            <Tooltip theme="error" content={error}>
              <Icon name="exclamation-circle" className={styles.errorIcon} size={'lg'} />
            </Tooltip>
          );
        },
        size: '45px',
      },
      {
        id: 'folder',
        label: 'Folder',
        renderCell: ({ data: dashUpgrade }) => {
          if (!dashUpgrade.folderName) {
            return (
              <Stack alignItems={'center'} gap={0.5}>
                <Icon name="folder" />
                <Badge color="red" text="Unknown Folder" />
              </Stack>
            );
          }
          return (
            <Stack alignItems={'center'} gap={0.5}>
              <Icon name="folder" />
              <Link
                rel="noreferrer"
                target="_blank"
                className={styles.textLink}
                href={makeFolderLink(dashUpgrade.folderUid)}
              >
                {dashUpgrade.folderName}
              </Link>
            </Stack>
          );
        },
        size: 2,
      },
      {
        id: 'dashboard',
        label: 'Dashboard',
        renderCell: ({ data: dashUpgrade }) => {
          if (!dashUpgrade.dashboardName) {
            return (
              <Stack alignItems={'center'} gap={0.5}>
                <Icon name="apps" />
                <Badge color="red" text={`Unknown Dashboard ID:${dashUpgrade.dashboardId}`} />
              </Stack>
            );
          }
          return (
            <Stack alignItems={'center'} gap={0.5}>
              <Icon name="apps" />
              <Link
                rel="noreferrer"
                target="_blank"
                className={styles.textLink}
                href={makeDashboardLink(dashUpgrade.dashboardUid)}
              >
                {dashUpgrade.dashboardName}
              </Link>
            </Stack>
          );
        },
        size: 2,
      },
      {
        id: 'new-folder-arrow',
        label: '',
        renderCell: ({ data: dashUpgrade }) => {
          const migratedFolderUid = dashUpgrade?.newFolderUid;
          const folderChanged = migratedFolderUid!! && migratedFolderUid !== dashUpgrade.folderUid;
          if (folderChanged && dashUpgrade?.newFolderName) {
            return <Icon name="arrow-right" />;
          }
          return null;
        },
        size: '45px',
      },
      {
        id: 'new-folder',
        label: 'New folder',
        renderCell: ({ data: dashUpgrade }) => {
          const migratedFolderUid = dashUpgrade?.newFolderUid;
          if (migratedFolderUid && migratedFolderUid !== dashUpgrade.folderUid && dashUpgrade?.newFolderName) {
            const newFolderWarning = dashUpgrade.warnings.find((warning) => warning.includes('dashboard alerts moved'));
            return (
              <Stack alignItems={'center'} gap={0.5}>
                <Icon name={'folder'} />
                <Link
                  rel="noreferrer"
                  target="_blank"
                  className={styles.textLink}
                  href={makeFolderLink(migratedFolderUid)}
                >
                  {dashUpgrade.newFolderName}
                </Link>
                {newFolderWarning && (
                  <Tooltip theme="info-alt" content={newFolderWarning} placement="top">
                    <Icon name={'info-circle'} />
                  </Tooltip>
                )}
              </Stack>
            );
          }
          return null;
        },
        size: 3,
      },
      {
        id: 'provisioned',
        label: '',
        className: styles.tableBadges,
        renderCell: ({ data: dashUpgrade }) => {
          const provisionedWarning = dashUpgrade.warnings.find((warning) =>
            warning.includes('failed to get provisioned status')
          );
          return (
            <>
              {dashUpgrade.provisioned && (
                <Badge
                  color="purple"
                  text={provisionedWarning ? 'Unknown' : 'Provisioned'}
                  tooltip={provisionedWarning}
                  icon={provisionedWarning ? 'exclamation-triangle' : undefined}
                  className={styles.badge}
                />
              )}
            </>
          );
        },
        size: '100px',
      },
      {
        id: 'error-badge',
        label: '',
        className: styles.tableBadges,
        renderCell: ({ data: dashUpgrade }) => {
          const migratedAlerts = dashUpgrade?.migratedAlerts ?? [];
          const nestedErrors = migratedAlerts.map((alertPair) => alertPair.error ?? '').filter((error) => !!error);
          if (nestedErrors.length === 0) {
            return null;
          }
          return <Badge color="red" key="errors" text={`${nestedErrors.length} errors`} className={styles.badge} />;
        },
        size: '90px',
      },
      {
        id: 'alert-count-badge',
        label: '',
        className: styles.tableBadges,
        renderCell: ({ data: dashUpgrade }) => {
          const migratedAlerts = dashUpgrade?.migratedAlerts ?? [];
          return (
            <Badge color="green" key="alerts" text={`${migratedAlerts.length} alert rules`} className={styles.badge} />
          );
        },
        size: '110px',
      },
      {
        id: 'actions',
        label: 'Actions',
        renderCell: ({ data: dashUpgrade }) => {
          return (
            <Stack gap={0.5} alignItems="center">
              {dashUpgrade.dashboardId && (
                <ActionIcon
                  // className={styles.destructiveActionIcon}
                  aria-label="re-upgrade legacy alerts for this dashboard"
                  key="upgrade-dashboard"
                  icon="sync"
                  tooltip="re-upgrade legacy alerts for this dashboard"
                  onClick={() => migrateDashboard({ dashboardId: dashUpgrade.dashboardId, skipExisting: false })}
                />
              )}
            </Stack>
          );
        },
        size: '70px',
      },
    ],
    [styles.tableBadges, styles.errorIcon, styles.textLink, styles.badge, migrateDashboard]
  );
};

const ufuzzy = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
});

const createfilterByMapping = <T,>(searchSpaceMap: (row: T) => string) => {
  return (filterables: T[], filter: string | undefined) => {
    if (!filter) {
      return filterables;
    }
    const haystack = filterables.map(searchSpaceMap);

    const [idxs, info, order] = ufuzzy.search(haystack, filter);
    if (info && order) {
      return order.map((idx) => filterables[info.idx[idx]]);
    } else if (idxs) {
      return idxs.map((idx) => filterables[idx]);
    }

    return filterables;
  };
};

interface SearchProps {
  searchFn: (searchPhrase: string) => void;
  searchPhrase: string | undefined;
  placeholder?: string;
}

const Search = ({ searchFn, searchPhrase, placeholder }: SearchProps) => {
  const [searchFilter, setSearchFilter] = useState(searchPhrase);

  const debouncedSearch = useMemo(() => debounce(searchFn, 600), [searchFn]);

  useEffect(() => {
    return () => {
      // Stop the invocation of the debounced function after unmounting
      debouncedSearch?.cancel();
    };
  }, [debouncedSearch]);

  return (
    <FilterInput
      placeholder={placeholder}
      value={searchFilter}
      width={55}
      escapeRegex={false}
      onChange={(value) => {
        setSearchFilter(value || '');
        if (value === '') {
          // This is so clicking clear is instant. Otherwise, clearing and switching tabs before debounce is ready will lose filter state.
          debouncedSearch?.cancel();
          searchFn('');
        } else {
          debouncedSearch(value || '');
        }
      }}
    />
  );
};

interface AlertTableProps {
  dashboardId: number;
  dashboardUid: string;
  showGuidelines?: boolean;
  emptyMessage?: string;
}

const AlertTable = ({
  dashboardId,
  dashboardUid,
  showGuidelines = false,
  emptyMessage = 'No alert upgrades found.',
}: AlertTableProps) => {
  const styles = useStyles2(getStyles);

  const selectRowsForDashUpgrade = useMemo(() => {
    const emptyArray: Array<DynamicTableItemProps<AlertPair>> = [];
    return createSelector(
      (res: OrgMigrationState | undefined) => res?.migratedDashboards ?? [],
      (res: OrgMigrationState | undefined, dashboardId: number) => dashboardId,
      (migratedDashboards, dashboardId) =>
        migratedDashboards
          ?.find((du) => du.dashboardId === dashboardId)
          ?.migratedAlerts.map((alertPair, Idx) => {
            return {
              id: `${alertPair?.legacyAlert?.id}-${Idx}`,
              data: alertPair,
            };
          }) ?? emptyArray
    );
  }, []);

  const { items } = upgradeApi.useGetOrgUpgradeSummaryQuery(undefined, {
    selectFromResult: ({ data }) => ({
      items: selectRowsForDashUpgrade(data, dashboardId),
    }),
  });

  const { useUpgradeAlertMutation } = upgradeApi;
  const [migrateAlert] = useUpgradeAlertMutation();

  const wrapperClass = cx(styles.wrapper, styles.rulesTable, { [styles.wrapperMargin]: showGuidelines });

  const columns: Array<DynamicTableColumnProps<AlertPair>> = [
    {
      id: 'legacyAlert',
      label: 'Legacy alert rule',
      renderCell: ({ data: alertPair }) => {
        if (!alertPair?.legacyAlert) {
          return null;
        }
        return (
          <>
            {dashboardUid ? (
              <Link
                rel="noreferrer"
                target="_blank"
                className={styles.textLink}
                href={createUrl(`/d/${encodeURIComponent(dashboardUid)}`, {
                  editPanel: String(alertPair.legacyAlert.panelId),
                  tab: 'alert',
                })}
              >
                {alertPair.legacyAlert.name}
              </Link>
            ) : (
              <Badge color="red" text={alertPair.legacyAlert.name} />
            )}
          </>
        );
      },
      size: 5,
    },
    {
      id: 'arrow',
      label: '',
      renderCell: ({ data: alertPair }) => {
        if (!alertPair?.legacyAlert) {
          return null;
        }
        return <Icon name="arrow-right" />;
      },
      size: '45px',
    },
    {
      id: 'alertRule',
      label: 'New alert rule',
      renderCell: ({ data: alertPair }) => {
        return (
          <Stack direction={'row'} gap={1}>
            {alertPair?.alertRule && (
              <Link
                rel="noreferrer"
                target="_blank"
                className={styles.textLink}
                href={createUrl(`/alerting/grafana/${alertPair.alertRule?.uid ?? ''}/view`, {})}
              >
                {alertPair.alertRule?.title ?? ''}
              </Link>
            )}
            {alertPair.error && (
              <Tooltip theme="error" content={alertPair.error}>
                <Icon name="exclamation-circle" className={styles.errorIcon} size={'lg'} />
              </Tooltip>
            )}
          </Stack>
        );
      },
      size: 5,
    },
    {
      id: 'contacts',
      label: 'Sends To',
      renderCell: ({ data: alertPair }) => {
        return (
          <>
            {!alertPair.error && (
              <TagList
                tags={alertPair?.alertRule?.sendsTo ?? []}
                displayMax={3}
                className={css({ justifyContent: 'flex-start', width: '100%' })}
              />
            )}
          </>
        );
      },
      size: 3,
    },
    {
      id: 'actions',
      label: 'Actions',
      renderCell: ({ data: alertPair }) => {
        if (!alertPair?.legacyAlert) {
          return null;
        }
        if (alertPair.legacyAlert.dashboardId <= 0 || alertPair.legacyAlert.panelId <= 0) {
          return null;
        }
        return (
          <Stack gap={0.5} alignItems="center">
            <ActionIcon
              // className={styles.destructiveActionIcon}
              aria-label="re-upgrade legacy alert"
              key="upgrade-alert"
              icon="sync"
              tooltip="re-upgrade legacy alert"
              onClick={() =>
                migrateAlert({
                  dashboardId: alertPair.legacyAlert.dashboardId,
                  panelId: alertPair.legacyAlert.panelId,
                  skipExisting: false,
                })
              }
            />
          </Stack>
        );
      },
      size: '70px',
    },
  ];

  if (!items.length) {
    return <div className={cx(wrapperClass, styles.emptyMessage)}>{emptyMessage}</div>;
  }

  const TableComponent = showGuidelines ? DynamicTableWithGuidelines : DynamicTable;

  return (
    <div className={wrapperClass} data-testid="rules-table">
      <TableComponent
        cols={columns}
        // isExpandable={true}
        items={items}
        // renderExpandedContent={({ data: rule }) => <RuleDetails rule={rule} />}
        pagination={{ itemsPerPage: 10 }}
        paginationStyles={styles.pagination}
      />
    </div>
  );
};

interface ErrorSummaryButtonProps {
  count: number;
  onClick: () => void;
}

const ErrorSummaryButton = ({ count, onClick }: ErrorSummaryButtonProps) => {
  return (
    <HorizontalGroup height="auto" justify="flex-start">
      <Tooltip content="Show all errors" placement="top">
        <Button fill="text" variant="destructive" icon="exclamation-circle" onClick={onClick}>
          {count > 1 ? <>{count} errors</> : <>1 error</>}
        </Button>
      </Tooltip>
    </HorizontalGroup>
  );
};

interface ErrorSummaryProps {
  errors: string[];
}

const ErrorSummary = ({ errors }: ErrorSummaryProps) => {
  const [expanded, setExpanded] = useState(false);
  const [closed, setClosed] = useLocalStorage('grafana.unifiedalerting.upgrade.hideErrors', true);
  const styles = useStyles2(getStyles);

  return (
    <>
      {!!errors.length && closed && <ErrorSummaryButton count={errors.length} onClick={() => setClosed(false)} />}
      {!!errors.length && !closed && (
        <Alert
          data-testid="upgrade-errors"
          title="Errors upgrading to Grafana Alerting"
          severity="error"
          onRemove={() => setClosed(true)}
        >
          {expanded && errors.map((item, idx) => <div key={idx}>{item}</div>)}
          {!expanded && (
            <>
              <div>{errors[0]}</div>
              {errors.length >= 2 && (
                <Button
                  className={styles.moreButton}
                  fill="text"
                  icon="angle-right"
                  size="sm"
                  onClick={() => setExpanded(true)}
                >
                  {errors.length - 1} more {pluralize('error', errors.length - 1)}
                </Button>
              )}
            </>
          )}
        </Alert>
      )}
    </>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapperMargin: css`
    ${theme.breakpoints.up('md')} {
      margin-left: 36px;
    }
  `,
  emptyMessage: css`
    padding: ${theme.spacing(1)};
  `,
  wrapper: css`
    width: auto;
    border-radius: ${theme.shape.radius.default};
  `,
  pagination: css`
    display: flex;
    margin: 0;
    padding-top: ${theme.spacing(1)};
    padding-bottom: ${theme.spacing(0.25)};
    justify-content: center;
    border-left: 1px solid ${theme.colors.border.medium};
    border-right: 1px solid ${theme.colors.border.medium};
    border-bottom: 1px solid ${theme.colors.border.medium};
  `,
  rulesTable: css`
    margin-top: ${theme.spacing(3)};
  `,
  errorIcon: css`
    fill: ${theme.colors.error.text};
  `,

  searchWrapper: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  textLink: css`
    color: ${theme.colors.text.link};
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  `,

  tabContent: css`
    margin-top: ${theme.spacing(2)};
  `,
  moreButton: css`
    padding: 0;
  `,
  tableBadges: css`
    justify-content: flex-end;
  `,
  badge: css`
    width: 100%;
    justify-content: center;
  `,

  separator: css`
    border-bottom: 1px solid ${theme.colors.border.weak};
    margin-top: ${theme.spacing(2)};
  `,
});

export default UpgradePage;
