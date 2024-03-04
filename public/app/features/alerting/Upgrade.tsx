import { css, cx } from '@emotion/css';
import uFuzzy from '@leeoniya/ufuzzy';
import { createSelector } from '@reduxjs/toolkit';
import { debounce } from 'lodash';
import pluralize from 'pluralize';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2, UrlQueryMap } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { locationService } from '@grafana/runtime';
import {
  Alert,
  Badge,
  Button,
  ConfirmModal,
  FilterInput,
  HorizontalGroup,
  Icon,
  Link,
  LoadingPlaceholder,
  Spinner,
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

import { getSearchPlaceholder } from '../search/tempI18nPhrases';

import { AlertPair, ContactPair, DashboardUpgrade, OrgMigrationState, upgradeApi } from './unified/api/upgradeApi';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from './unified/components/DynamicTable';
import { DynamicTableWithGuidelines } from './unified/components/DynamicTableWithGuidelines';
import { Matchers } from './unified/components/notification-policies/Matchers';
import { ActionIcon } from './unified/components/rules/ActionIcon';
import { createContactPointLink, makeDashboardLink, makeFolderAlertsLink } from './unified/utils/misc';
import { createUrl } from './unified/utils/url';

export const UpgradePage = () => {
  const [, { isLoading: isUpgradeLoading }] = upgradeApi.useUpgradeOrgMutation({
    fixedCacheKey: 'upgrade-org-loading',
  });
  const [, { isLoading: isCancelLoading }] = upgradeApi.useCancelOrgUpgradeMutation({
    fixedCacheKey: 'cancel-org-upgrade-loading',
  });
  const {
    currentData: summary,
    isError: isFetchError,
    error: fetchError,
    isLoading: isLoading,
  } = upgradeApi.useGetOrgUpgradeSummaryQuery(undefined, {
    pollingInterval: 10000,
    skip: isCancelLoading || isUpgradeLoading, // Stop polling when upgrade or cancel is in progress.
  });

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

  const showError = isFetchError;
  const showLoading = isLoading;
  const showData = !isLoading && !isFetchError && hasData;

  return (
    <Page navId="alerting-upgrade" actions={cancelUpgrade}>
      <Page.Contents>
        {showError && (
          <Alert severity="error" title="Error loading Grafana Alerting upgrade information">
            {fetchError instanceof Error ? fetchError.message : 'Unknown error.'}
          </Alert>
        )}
        {showLoading && <Loading text={'Loading...'} />}
        {showData && (
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

  useEffect(() => {
    setActiveTab(tab);
  }, [tab]);

  return (
    <>
      <Alert severity={'info'} title={'Grafana Alerting upgrade guide'}>
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
      </Alert>
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
  const [startOver] = upgradeApi.useCancelOrgUpgradeMutation({ fixedCacheKey: 'cancel-org-upgrade-loading' });
  const [showConfirmStartOver, setShowConfirmStartOver] = useState(false);

  const cancelUpgrade = async () => {
    startOver();
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
        {'Reset upgrade'}
      </Button>
      {showConfirmStartOver && (
        <ConfirmModal
          isOpen={true}
          title="Reset upgrade"
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
          confirmText="Reset upgrade"
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

const AlertTabContentWrapper = () => {
  const columns = useAlertColumns();
  const filterParam = 'alertFilter';
  const [queryParam, updateQueryParam] = useSingleQueryParam(filterParam);

  const [startAlertUpgrade, { isLoading: isAlertLoading }] = upgradeApi.useUpgradeAllDashboardsMutation({
    fixedCacheKey: 'upgrade-alerts-loading',
  });
  const [_, { isLoading: isChannelLoading }] = upgradeApi.useUpgradeAllChannelsMutation({
    fixedCacheKey: 'upgrade-channels-loading',
  });
  const isUpgrading = isChannelLoading || isAlertLoading;

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
      `${dashUpgrade.folderName} ${dashUpgrade.dashboardName} ${dashUpgrade.newFolderName} ${dashUpgrade.migratedAlerts
        .map((a) => a.legacyAlert?.name ?? '')
        .join(' ')}`,
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

  const syncNewButton = useMemo(() => {
    const syncAlerting = async () => {
      await startAlertUpgrade({ skipExisting: true });
    };

    return (
      <Tooltip
        theme="info-alt"
        content={
          isUpgrading ? 'Upgrade in progress...' : 'Upgrade all newly created legacy alerts since the previous run.'
        }
        placement="top"
      >
        <Button size="md" variant="secondary" onClick={syncAlerting} icon={'plus-circle'} disabled={isUpgrading}>
          Upgrade New Alerts
        </Button>
      </Tooltip>
    );
  }, [startAlertUpgrade, isUpgrading]);

  const syncAllButton = useMemo(() => {
    const syncAlerting = async () => {
      await startAlertUpgrade({ skipExisting: false });
    };

    return (
      <Tooltip
        theme="info-alt"
        content={isUpgrading ? 'Upgrade in progress...' : 'Upgrade all legacy alerts from scratch.'}
        placement="top"
      >
        <Button size="md" variant="secondary" onClick={syncAlerting} icon={'sync'} disabled={isUpgrading}>
          Upgrade All Alerts
        </Button>
      </Tooltip>
    );
  }, [startAlertUpgrade, isUpgrading]);

  return (
    <AlertTabContent
      rows={items}
      queryParam={queryParam}
      updateQueryParam={updateQueryParam}
      searchSpaceMap={searchSpaceMap}
      searchPlaceholder={getSearchPlaceholder(false)}
      syncNewButton={syncNewButton}
      syncAllButton={syncAllButton}
      isUpgrading={isUpgrading}
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
  const [queryParam, updateQueryParam] = useSingleQueryParam(filterParam);

  const [startChannelUpgrade, { isLoading: isChannelLoading }] = upgradeApi.useUpgradeAllChannelsMutation({
    fixedCacheKey: 'upgrade-channels-loading',
  });
  const [, { isLoading: isAlertLoading }] = upgradeApi.useUpgradeAllDashboardsMutation({
    fixedCacheKey: 'upgrade-alerts-loading',
  });
  const isUpgrading = isChannelLoading || isAlertLoading;

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

  const syncNewButton = useMemo(() => {
    const syncAlerting = async () => {
      await startChannelUpgrade({ skipExisting: true });
    };

    return (
      <Tooltip
        theme="info-alt"
        content={
          isUpgrading
            ? 'Upgrade in progress...'
            : 'Upgrade all newly created legacy notification channels since the previous run.'
        }
        placement="top"
      >
        <Button size="md" variant="secondary" onClick={syncAlerting} icon={'plus-circle'} disabled={isUpgrading}>
          Upgrade New Channels
        </Button>
      </Tooltip>
    );
  }, [startChannelUpgrade, isUpgrading]);

  const syncAllButton = useMemo(() => {
    const syncAlerting = async () => {
      await startChannelUpgrade({ skipExisting: false });
    };

    return (
      <Tooltip
        theme="info-alt"
        content={isUpgrading ? 'Upgrade in progress...' : 'Upgrade all legacy notification channels from scratch.'}
        placement="top"
      >
        <Button size="md" variant="secondary" onClick={syncAlerting} icon={'sync'} disabled={isUpgrading}>
          Upgrade All Channels
        </Button>
      </Tooltip>
    );
  }, [startChannelUpgrade, isUpgrading]);

  return (
    <ChannelTabContent
      rows={items}
      queryParam={queryParam}
      updateQueryParam={updateQueryParam}
      searchSpaceMap={searchSpaceMap}
      searchPlaceholder={'Search for channel and contact point names'}
      syncNewButton={syncNewButton}
      syncAllButton={syncAllButton}
      isUpgrading={isUpgrading}
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
  updateQueryParam?: (values: string) => void;
  queryParam?: string;
  searchSpaceMap: (row: T) => string;
  searchPlaceholder: string;
  syncNewButton: JSX.Element;
  syncAllButton: JSX.Element;
  isUpgrading: boolean;
  columns: Array<DynamicTableColumnProps<T>>;
  isExpandable?: boolean;
  renderExpandedContent?: (item: DynamicTableItemProps<T>) => React.ReactNode;
  emptyMessage: string;
}

const UpgradeTabContent = <T extends object>({
  rows = [],
  queryParam,
  updateQueryParam,
  searchSpaceMap,
  columns,
  isExpandable = false,
  renderExpandedContent,
  emptyMessage,
  searchPlaceholder,
  syncNewButton,
  syncAllButton,
  isUpgrading,
}: UpgradeTabContentProps<T>) => {
  const styles = useStyles2(getStyles);

  const isLoading = isUpgrading || isUpgrading;

  const filterFn = useMemo(() => {
    return createfilterByMapping<T>(searchSpaceMap, rows);
  }, [searchSpaceMap, rows]);

  const items = useMemo((): Array<DynamicTableItemProps<T>> => {
    return filterFn(queryParam).map((row, Idx) => {
      return {
        id: `${searchSpaceMap(row)} - ${Idx}`,
        data: row,
      };
    });
  }, [searchSpaceMap, filterFn, queryParam]);

  const showGuidelines = false;
  const wrapperClass = cx(styles.wrapper, { [styles.wrapperMargin]: showGuidelines });

  const TableComponent = showGuidelines ? DynamicTableWithGuidelines : DynamicTable;

  const pagination = useMemo(() => ({ itemsPerPage: 50 }), []);

  return (
    <>
      <div className={styles.searchWrapper}>
        <Stack direction="column" gap={1}>
          <Stack direction="row" gap={1}>
            <Search
              placeholder={searchPlaceholder}
              searchFn={(phrase) => {
                updateQueryParam?.(phrase || '');
              }}
              searchPhrase={queryParam || ''}
            />
            {syncNewButton}
            {syncAllButton}
          </Stack>
        </Stack>
      </div>
      {isLoading && <Loading text={isUpgrading ? 'Upgrade in progress...' : 'Loading...'} />}
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
        id: 'contact-level-error',
        label: '',
        renderCell: ({ data: contactPair }) => {
          if (!contactPair.error) {
            return null;
          }
          const warning =
            contactPair?.error === 'channel not upgraded' || contactPair?.error === 'channel no longer exists';
          return (
            <Tooltip theme="error" content={contactPair.error}>
              <Icon name="exclamation-circle" className={warning ? styles.warningIcon : styles.errorIcon} size={'lg'} />
            </Tooltip>
          );
        },
        size: '45px',
      },
      {
        id: 'legacyChannel',
        label: 'Legacy Channel',
        // eslint-disable-next-line react/display-name
        renderCell: ({ data: contactPair }) => {
          if (!contactPair?.legacyChannel) {
            return null;
          }

          if (!contactPair.legacyChannel.name && contactPair.contactPoint?.name) {
            return <Badge color="red" text={`Deleted Channel (ID: ${contactPair.legacyChannel?.id})`} />;
          }

          if (!contactPair.legacyChannel.name) {
            return <Badge color="red" text={`Unknown Channel (ID: ${contactPair.legacyChannel?.id})`} />;
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
          return <Matchers matchers={contactPair?.contactPoint?.routeMatchers ?? []} />;
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
          if (pair.isUpgrading) {
            return (
              <Stack gap={0.5} alignItems="center">
                <Spinner size="sm" inline={true} className={styles.spinner} />
              </Stack>
            );
          }
          if (pair?.error === 'channel not upgraded') {
            return (
              <Stack gap={0.5} alignItems="center">
                <ActionIcon
                  aria-label="upgrade legacy notification channel"
                  key="upgrade-channel"
                  icon="plus"
                  tooltip="upgrade legacy notification channel"
                  onClick={() => migrateChannel({ channelId: pair.legacyChannel.id, skipExisting: false })}
                />
              </Stack>
            );
          }
          if (pair?.error === 'channel no longer exists') {
            return (
              <Stack gap={0.5} alignItems="center">
                <ActionIcon
                  aria-label="remove upgraded notification channel"
                  key="upgrade-channel"
                  icon="minus"
                  tooltip="remove upgraded notification channel"
                  onClick={() => migrateChannel({ channelId: pair.legacyChannel.id, skipExisting: false })}
                />
              </Stack>
            );
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
    [styles.textLink, styles.errorIcon, styles.warningIcon, styles.badge, styles.spinner, migrateChannel]
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
          if (!dashUpgrade.error) {
            return null;
          }
          const warning =
            dashUpgrade?.error === 'dashboard not upgraded' || dashUpgrade?.error === 'dashboard no longer exists';
          return (
            <Tooltip theme="error" content={dashUpgrade.error}>
              <Icon name="exclamation-circle" className={warning ? styles.warningIcon : styles.errorIcon} size={'lg'} />
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
                href={makeFolderAlertsLink(dashUpgrade.folderUid, dashUpgrade.folderName)}
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
                <Badge color="red" text={`Unknown Dashboard (ID: ${dashUpgrade.dashboardId})`} />
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
            const newFolderWarning = dashUpgrade.warning.includes('dashboard alerts moved');
            return (
              <Stack alignItems={'center'} gap={0.5}>
                <Icon name={'folder'} />
                <Link
                  rel="noreferrer"
                  target="_blank"
                  className={styles.textLink}
                  href={makeFolderAlertsLink(migratedFolderUid, dashUpgrade.newFolderName)}
                >
                  {dashUpgrade.newFolderName}
                </Link>
                {newFolderWarning && (
                  <Tooltip theme="info-alt" content={dashUpgrade.warning} placement="top">
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
          const provisionedWarning = dashUpgrade.warning.includes('provisioned status:');
          return (
            <>
              {dashUpgrade.provisioned && (
                <Badge
                  color="purple"
                  text={provisionedWarning ? 'Unknown' : 'Provisioned'}
                  tooltip={dashUpgrade.warning}
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
        size: '115px',
      },
      {
        id: 'actions',
        label: 'Actions',
        renderCell: ({ data: dashUpgrade }) => {
          if (dashUpgrade.isUpgrading) {
            return (
              <Stack gap={0.5} alignItems="center">
                <Spinner size="sm" inline={true} className={styles.spinner} />
              </Stack>
            );
          }
          if (dashUpgrade?.error === 'dashboard not upgraded') {
            return (
              <Stack gap={0.5} alignItems="center">
                <ActionIcon
                  aria-label="upgrade legacy alerts for this dashboard"
                  key="upgrade-dashboard"
                  icon="plus"
                  tooltip="upgrade legacy alerts for this dashboard"
                  onClick={() => migrateDashboard({ dashboardId: dashUpgrade.dashboardId, skipExisting: false })}
                />
              </Stack>
            );
          }
          if (dashUpgrade?.error === 'dashboard no longer exists') {
            return (
              <Stack gap={0.5} alignItems="center">
                <ActionIcon
                  aria-label="remove upgraded alerts for this dashboard"
                  key="upgrade-dashboard"
                  icon="minus"
                  tooltip="remove upgraded alerts for this dashboard"
                  onClick={() => migrateDashboard({ dashboardId: dashUpgrade.dashboardId, skipExisting: false })}
                />
              </Stack>
            );
          }
          return (
            <Stack gap={0.5} alignItems="center">
              {dashUpgrade.dashboardId && (
                <ActionIcon
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
    [
      styles.tableBadges,
      styles.errorIcon,
      styles.warningIcon,
      styles.textLink,
      styles.badge,
      styles.spinner,
      migrateDashboard,
    ]
  );
};

const ufuzzy = new uFuzzy({
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1,
});

const createfilterByMapping = <T,>(searchSpaceMap: (row: T) => string, filterables: T[]) => {
  const haystack = filterables.map(searchSpaceMap);
  return (filter: string | undefined) => {
    if (!filter) {
      return filterables;
    }

    const [idxs, info, order] = ufuzzy.search(haystack, filter, 5);
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
    setSearchFilter(searchPhrase);
    return () => {
      // Stop the invocation of the debounced function after unmounting
      debouncedSearch?.cancel();
    };
  }, [debouncedSearch, searchPhrase]);

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
      id: 'alert-level-error',
      label: '',
      renderCell: ({ data: alertPair }) => {
        if (!alertPair.error) {
          return null;
        }
        const warning = alertPair?.error === 'alert not upgraded' || alertPair?.error.endsWith('no longer exists');
        return (
          <Tooltip theme="error" content={alertPair.error}>
            <Icon name="exclamation-circle" className={warning ? styles.warningIcon : styles.errorIcon} size={'lg'} />
          </Tooltip>
        );
      },
      size: '45px',
    },
    {
      id: 'legacyAlert',
      label: 'Legacy alert rule',
      renderCell: ({ data: alertPair }) => {
        if (!alertPair?.legacyAlert) {
          return null;
        }
        const deleted = (alertPair.error ?? '').endsWith('no longer exists');
        if (deleted) {
          return <Badge color="red" text={`Deleted Alert: (ID: ${alertPair.legacyAlert?.panelId})`} />;
        }
        return (
          <>
            {dashboardUid ? (
              <Link
                rel="noreferrer"
                target="_blank"
                className={alertPair.legacyAlert.name ? styles.textLink : styles.errorLink}
                href={createUrl(`/d/${encodeURIComponent(dashboardUid)}`, {
                  editPanel: String(alertPair.legacyAlert.panelId),
                  tab: 'alert',
                })}
              >
                {alertPair.legacyAlert.name || 'Missing Title'}
              </Link>
            ) : (
              <Badge color="red" text={alertPair.legacyAlert.name || 'Unknown Alert'} />
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
            {alertPair?.alertRule && (
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
        if (alertPair.isUpgrading) {
          return (
            <Stack gap={0.5} alignItems="center">
              <Spinner size="sm" inline={true} className={styles.spinner} />
            </Stack>
          );
        }
        if (alertPair?.error === 'alert not upgraded') {
          return (
            <Stack gap={0.5} alignItems="center">
              <ActionIcon
                aria-label="upgrade legacy alert"
                key="upgrade-alert"
                icon="plus"
                tooltip="upgrade legacy alert"
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
        }
        if (alertPair?.error?.endsWith('no longer exists')) {
          return (
            <Stack gap={0.5} alignItems="center">
              <ActionIcon
                aria-label="remove upgraded alert"
                key="upgrade-alert"
                icon="minus"
                tooltip="remove upgraded alert"
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
        }
        return (
          <Stack gap={0.5} alignItems="center">
            <ActionIcon
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
        items={items}
        pagination={{ itemsPerPage: 50 }}
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

interface LoadingProps {
  text?: string;
}

const Loading = ({ text = 'Loading...' }: LoadingProps) => {
  return (
    <div className="page-loader-wrapper">
      <LoadingPlaceholder text={text} />
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  wrapperMargin: css({
    [theme.breakpoints.up('md')]: {
      marginLeft: '36px',
    },
  }),

  emptyMessage: css({
    padding: theme.spacing(1),
  }),

  wrapper: css({
    width: 'auto',
    borderRadius: theme.shape.radius.default,
  }),

  pagination: css({
    display: 'flex',
    margin: '0',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(0.25),
    justifyContent: 'center',
    borderLeft: `1px solid ${theme.colors.border.medium}`,
    borderRight: `1px solid ${theme.colors.border.medium}`,
    borderBottom: `1px solid ${theme.colors.border.medium}`,
  }),

  rulesTable: css({
    marginTop: theme.spacing(3),
  }),

  errorIcon: css({
    fill: theme.colors.error.text,
  }),

  warningIcon: css({
    fill: theme.colors.warning.text,
  }),

  searchWrapper: css({
    marginBottom: theme.spacing(2),
  }),

  textLink: css({
    color: theme.colors.text.link,
    cursor: 'pointer',

    '&:hover': {
      textDecoration: 'underline',
    },
  }),

  errorLink: css({
    color: theme.colors.error.text,
    cursor: 'pointer',

    '&:hover': {
      textDecoration: 'underline',
    },
  }),

  tabContent: css({
    marginTop: theme.spacing(2),
  }),

  moreButton: css({
    padding: '0',
  }),

  tableBadges: css({
    justifyContent: 'flex-end',
  }),

  badge: css({
    width: '100%',
    justifyContent: 'center',
  }),

  separator: css({
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    marginTop: theme.spacing(2),
  }),

  spinner: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.spacing(3),
    height: theme.spacing(3),
  }),
});

export default UpgradePage;
