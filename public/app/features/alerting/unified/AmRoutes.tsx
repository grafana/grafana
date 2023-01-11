import { css } from '@emotion/css';
import { groupBy, merge, pick, reduce, take, uniqueId, upperFirst } from 'lodash';
import pluralize from 'pluralize';
import React, { FC, Fragment, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import {
  Alert,
  Badge,
  Button,
  getTagColorsFromName,
  Icon,
  LoadingPlaceholder,
  Modal,
  ModalProps,
  Spinner,
  Tab,
  TabContent,
  TabsBar,
  Tooltip,
  useStyles2,
  useTheme2,
  withErrorBoundary,
} from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { ObjectMatcher, Receiver, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';
import { ReceiversState, useDispatch } from 'app/types';

import { useCleanup } from '../../../core/hooks/useCleanup';

import { alertmanagerApi } from './api/alertmanagerApi';
import { useGetContactPointsState } from './api/receiversApi';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import { HoverCard } from './components/HoverCard';
import { NoAlertManagerWarning } from './components/NoAlertManagerWarning';
import { ProvisionedResource, ProvisioningAlert } from './components/Provisioning';
import { Spacer } from './components/Spacer';
import { AmRootRouteForm } from './components/amroutes/AmRootRouteForm';
import { AmRoutesExpandedForm } from './components/amroutes/AmRoutesExpandedForm';
import { MuteTimingsTable } from './components/amroutes/MuteTimingsTable';
import { useGetAmRouteReceiverWithGrafanaAppTypes } from './components/receivers/grafanaAppReceivers/grafanaApp';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from './hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertGroupsAction, fetchAlertManagerConfigAction, updateAlertManagerConfigAction } from './state/actions';
import { FormAmRoute } from './types/amroutes';
import { getNotificationsPermissions } from './utils/access-control';
import { addUniqueIdentifierToRoute, normalizeMatchers } from './utils/amroutes';
import { isVanillaPrometheusAlertManagerDataSource } from './utils/datasource';
import { initialAsyncRequestState } from './utils/redux';
import { addRouteToParentRoute, mergePartialAmRouteWithRouteTree, omitRouteFromRouteTree } from './utils/routeTree';

enum ActiveTab {
  NotificationPolicies,
  MuteTimings,
}

const AmRoutes = () => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  // TODO add querystring param for the current tab so we can route to it immediately
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.NotificationPolicies);
  const [updatingTree, setUpdatingTree] = useState<boolean>(false);

  const { useGetAlertmanagerChoiceQuery } = alertmanagerApi;
  const { currentData: alertmanagerChoice } = useGetAlertmanagerChoiceQuery();

  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName(alertManagers);

  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);
  const contactPointsState = useGetContactPointsState(alertManagerSourceName ?? '');

  useEffect(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  const {
    result,
    loading: resultLoading,
    error: resultError,
  } = (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;

  const config = result?.alertmanager_config;
  const receivers = config?.receivers ?? [];

  const rootRoute = useMemo(() => {
    if (config?.route) {
      return addUniqueIdentifierToRoute(config.route);
    }

    return;
  }, [config?.route]);

  const isProvisioned = Boolean(config?.route?.provenance);

  // const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups);
  // const fetchAlertGroups = alertGroups[alertManagerSourceName || ''] ?? initialAsyncRequestState;

  function handleSave(partialRoute: Partial<FormAmRoute>) {
    if (!rootRoute) {
      return;
    }
    const newRouteTree = mergePartialAmRouteWithRouteTree(alertManagerSourceName ?? '', partialRoute, rootRoute);
    updateRouteTree(newRouteTree);
  }

  function handleDelete(route: RouteWithID) {
    if (!rootRoute) {
      return;
    }
    const newRouteTree = omitRouteFromRouteTree(route, rootRoute);
    updateRouteTree(newRouteTree);
  }

  function handleAdd(partialRoute: Partial<FormAmRoute>, parentRoute: RouteWithID) {
    if (!rootRoute) {
      return;
    }

    const newRouteTree = addRouteToParentRoute(alertManagerSourceName ?? '', partialRoute, parentRoute, rootRoute);
    updateRouteTree(newRouteTree);
  }

  function updateRouteTree(routeTree: Route) {
    if (!result) {
      return;
    }

    setUpdatingTree(true);

    dispatch(
      updateAlertManagerConfigAction({
        newConfig: {
          ...result,
          alertmanager_config: {
            ...result.alertmanager_config,
            route: routeTree,
          },
        },
        oldConfig: result,
        alertManagerSourceName: alertManagerSourceName!,
        successMessage: 'Updated notification policies',
        refetch: true,
      })
    )
      .unwrap()
      .then(() => {
        if (alertManagerSourceName) {
          dispatch(fetchAlertGroupsAction(alertManagerSourceName));
        }
        closeEditModal();
        closeAddModal();
        closeDeleteModal();
      })
      .finally(() => {
        setUpdatingTree(false);
      });
  }

  // edit, add, delete modals
  const [addModal, openAddModal, closeAddModal] = useAddPolicyModal(receivers, handleAdd, updatingTree);
  const [editModal, openEditModal, closeEditModal] = useEditPolicyModal(
    alertManagerSourceName ?? '',
    receivers,
    handleSave,
    updatingTree
  );
  const [deleteModal, openDeleteModal, closeDeleteModal] = useDeletePolicyModal(handleDelete, updatingTree);

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));

  // fetch AM instances grouping
  useEffect(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertGroupsAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  if (!alertManagerSourceName) {
    return (
      <AlertingPageWrapper pageId="am-routes">
        <NoAlertManagerWarning availableAlertManagers={alertManagers} />
      </AlertingPageWrapper>
    );
  }

  const readOnly = alertManagerSourceName
    ? isVanillaPrometheusAlertManagerDataSource(alertManagerSourceName) || isProvisioned
    : true;

  const numberOfMuteTimings = result?.alertmanager_config.mute_time_intervals?.length ?? 0;
  const haveData = result && !resultError && !resultLoading;
  const isLoading = !result && resultLoading;
  const haveError = resultError && !resultLoading;

  const childPolicies = rootRoute?.routes ?? [];
  const matchers = normalizeMatchers(rootRoute ?? {});
  const timingOptions = {
    group_wait: rootRoute?.group_wait,
    group_interval: rootRoute?.group_interval,
    repeat_interval: rootRoute?.repeat_interval,
  };

  return (
    <AlertingPageWrapper pageId="am-routes">
      <AlertManagerPicker
        current={alertManagerSourceName}
        onChange={setAlertManagerSourceName}
        dataSources={alertManagers}
      />
      <TabsBar>
        <Tab
          label={'Notification Policies'}
          active={activeTab === ActiveTab.NotificationPolicies}
          onChangeTab={() => {
            setActiveTab(ActiveTab.NotificationPolicies);
          }}
        />
        <Tab
          label={'Mute Timings'}
          active={activeTab === ActiveTab.MuteTimings}
          counter={numberOfMuteTimings}
          onChangeTab={() => {
            setActiveTab(ActiveTab.MuteTimings);
          }}
        />
        <Spacer />
        {haveData && activeTab === ActiveTab.MuteTimings && <Button type="button">Add mute timing</Button>}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {isLoading && <LoadingPlaceholder text="Loading Alertmanager config..." />}
        {haveError && (
          <Alert severity="error" title="Error loading Alertmanager config">
            {resultError.message || 'Unknown error.'}
          </Alert>
        )}
        {haveData && (
          <>
            {activeTab === ActiveTab.NotificationPolicies && (
              <>
                <GrafanaAlertmanagerDeliveryWarning
                  currentAlertmanager={alertManagerSourceName}
                  alertmanagerChoice={alertmanagerChoice}
                />
                {isProvisioned && <ProvisioningAlert resource={ProvisionedResource.RootNotificationPolicy} />}
                {rootRoute && haveData && (
                  <Policy
                    isDefault
                    receivers={receivers}
                    currentRoute={rootRoute}
                    contactPoint={rootRoute.receiver}
                    contactPointsState={contactPointsState.receivers}
                    groupBy={rootRoute.group_by}
                    timingOptions={timingOptions}
                    readOnly={readOnly}
                    matchers={matchers}
                    muteTimings={rootRoute.mute_time_intervals}
                    childPolicies={childPolicies}
                    continueMatching={rootRoute.continue}
                    alertManagerSourceName={alertManagerSourceName}
                    onAddPolicy={openAddModal}
                    onEditPolicy={openEditModal}
                    onDeletePolicy={openDeleteModal}
                  />
                )}
                {addModal}
                {editModal}
                {deleteModal}
              </>
            )}
            {activeTab === ActiveTab.MuteTimings && (
              <MuteTimingsTable alertManagerSourceName={alertManagerSourceName} />
            )}
          </>
        )}
      </TabContent>
    </AlertingPageWrapper>
  );
};

type TimingOptions = {
  group_wait?: string;
  group_interval?: string;
  repeat_interval?: string;
};

interface PolicyComponentProps {
  childPolicies: RouteWithID[];
  receivers: Receiver[];
  isDefault?: boolean;
  matchers?: ObjectMatcher[];
  numberOfInstances?: number;
  contactPoint?: string;
  contactPointsState: ReceiversState;
  groupBy?: string[];
  muteTimings?: string[];
  readOnly?: boolean;
  timingOptions?: TimingOptions;
  continueMatching?: boolean;
  alertManagerSourceName: string;
  inheritedProperties?: InhertitableProperties;

  currentRoute: RouteWithID;
  onEditPolicy: (route: RouteWithID, isDefault?: boolean) => void;
  onAddPolicy: (route: RouteWithID) => void;
  onDeletePolicy: (route: RouteWithID) => void;
}

const Policy: FC<PolicyComponentProps> = ({
  childPolicies,
  receivers,
  isDefault,
  matchers,
  numberOfInstances = 0,
  contactPoint,
  contactPointsState,
  groupBy,
  muteTimings = [],
  timingOptions,
  readOnly = true,
  continueMatching = false,
  alertManagerSourceName,
  currentRoute,
  inheritedProperties,
  onEditPolicy,
  onAddPolicy,
  onDeletePolicy,
}) => {
  const styles = useStyles2(getStyles);
  const isDefaultPolicy = isDefault !== undefined;

  const permissions = getNotificationsPermissions(alertManagerSourceName);
  const canEditRoutes = contextSrv.hasPermission(permissions.update);
  const canDeleteRoutes = contextSrv.hasPermission(permissions.delete);

  const hasMatchers = Boolean(matchers && matchers.length);
  const hasMuteTimings = Boolean(muteTimings.length);

  // gather warnings and errors here
  const warnings: ReactNode[] = [];
  const errors: ReactNode[] = [];

  // if the route has no matchers, is not the default policy (that one has none) and it does not continue
  // then we should warn the user that it's a suspicious setup
  if (!hasMatchers && !isDefaultPolicy && !continueMatching) {
    warnings.push(wildcardRouteWarning);
  }

  // if the receiver / contact point has any errors show it on the policy
  const actualContactPoint = contactPoint ?? inheritedProperties?.receiver ?? '';
  const contactPointErrors = Object.entries(contactPointsState[actualContactPoint]?.notifiers).reduce(
    (acc: JSX.Element[] = [], [_, notifierStatuses]) => {
      const notifierErrors = notifierStatuses
        .filter((status) => status.lastNotifyAttemptError)
        .map((status) => status.lastNotifyAttemptError);

      if (notifierErrors.length > 0) {
        acc.push(<Label icon="at" key={uniqueId()} label={'Contact Point'} value={notifierErrors} />);
      }

      return acc;
    },
    []
  );

  contactPointErrors.forEach((error) => {
    errors.push(error);
  });

  const hasChildPolicies = Boolean(childPolicies.length);
  const isGrouping = Array.isArray(groupBy) && groupBy.length > 0;
  const hasInheritedProperties = inheritedProperties && Object.keys(inheritedProperties).length > 0;

  const isEditable = canEditRoutes;
  const isDeletable = canDeleteRoutes && !isDefault;

  // TODO dead branch detection, warnings for all sort of configs that won't work or will never be activated
  return (
    <Stack direction="column" gap={1.5}>
      <div className={styles.policyWrapper}>
        {continueMatching === true && (
          <Tooltip placement="top" content="This route will continue matching other policies">
            <div className={styles.continueMatching}>
              <Icon name="arrow-down" />
            </div>
          </Tooltip>
        )}
        <Stack direction="column" gap={0}>
          {/* Matchers and actions */}
          <div className={styles.matchersRow}>
            <Stack direction="row" alignItems="center" gap={1}>
              {!isDefaultPolicy && (
                <strong>
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Icon name="x" /> Matchers
                  </Stack>
                </strong>
              )}
              {isDefaultPolicy ? (
                <>
                  <strong>Default policy</strong>
                  <span className={styles.metadata}>
                    All alert instances will be handled by the default policy if no other matching policies are found.
                  </span>
                </>
              ) : hasMatchers ? (
                <Matchers matchers={matchers ?? []} />
              ) : (
                <span className={styles.metadata}>No matchers</span>
              )}
              <Spacer />
              {errors.length > 0 && (
                <HoverCard
                  arrow
                  placement="top"
                  content={
                    <Stack direction="column" gap={0.5}>
                      {errors.map((error) => (
                        <Fragment key={uniqueId()}>{error}</Fragment>
                      ))}
                    </Stack>
                  }
                >
                  <span>
                    <Badge icon="exclamation-circle" color="red" text={pluralize('error', errors.length, true)} />
                  </span>
                </HoverCard>
              )}
              {warnings.length === 1 && warnings[0]}
              {warnings.length > 1 && (
                <HoverCard
                  arrow
                  placement="top"
                  content={
                    <Stack direction="column" gap={0.5}>
                      {warnings.map((warning) => (
                        <Fragment key={uniqueId()}>{warning}</Fragment>
                      ))}
                    </Stack>
                  }
                >
                  <span>
                    <Badge
                      icon="exclamation-triangle"
                      color="orange"
                      text={pluralize('warning', warnings.length, true)}
                    />
                  </span>
                </HoverCard>
              )}
              {!readOnly && (
                <Stack direction="row" gap={0.5}>
                  {isEditable && (
                    <Button
                      variant="secondary"
                      icon="pen"
                      size="sm"
                      onClick={() => onEditPolicy(currentRoute, isDefault)}
                      type="button"
                    >
                      Edit
                    </Button>
                  )}
                  {isDeletable && (
                    <Button
                      variant="secondary"
                      icon="trash-alt"
                      size="sm"
                      onClick={() => onDeletePolicy(currentRoute)}
                      type="button"
                    />
                  )}
                </Stack>
              )}
            </Stack>
          </div>

          {/* Metadata row */}
          <div className={styles.metadataRow}>
            <Stack direction="row" alignItems="center" gap={1}>
              <MetaText icon="layers-alt">
                <Strong>{numberOfInstances}</Strong>
                <span>{pluralize('instance', numberOfInstances)}</span>
              </MetaText>
              {contactPoint && (
                <MetaText icon="at">
                  <span>Delivered to</span>
                  <ContactPointsHoverDetails
                    alertManagerSourceName={alertManagerSourceName}
                    receivers={receivers}
                    contactPoint={contactPoint}
                  />
                </MetaText>
              )}
              {isGrouping && (
                <MetaText icon="layer-group">
                  <span>Grouped by</span>
                  <Strong>{groupBy.join(', ')}</Strong>
                </MetaText>
              )}
              {/* we only want to show "no grouping" on the root policy, children with empty groupBy will inherit from the parent policy */}
              {!isGrouping && isDefaultPolicy && (
                <MetaText icon="layer-group">
                  <span>Not grouping</span>
                </MetaText>
              )}
              {hasMuteTimings && (
                <MetaText icon="calendar-slash">
                  <span>Muted when</span>
                  <HoverCard
                    arrow
                    placement="top"
                    header={<MetaText icon="calendar-slash">Mute Timings</MetaText>}
                    content={
                      // TODO show a combined view of all mute timings here, combining the weekdays, years, months, etc
                      <Stack direction="row" gap={0.5}>
                        <Label label="Weekdays" value="Saturday and Sunday" />
                      </Stack>
                    }
                  >
                    <div>
                      <Strong>{muteTimings.join(', ')}</Strong>
                    </div>
                  </HoverCard>
                </MetaText>
              )}
              {timingOptions && Object.values(timingOptions).some(Boolean) && (
                <TimingOptionsMeta timingOptions={timingOptions} />
              )}
              {hasInheritedProperties && (
                <>
                  <MetaText icon="corner-down-right-alt">
                    <span>Inherited</span>
                    <HoverCard
                      arrow
                      placement="top"
                      showAfter={100}
                      content={
                        <Stack direction="row" gap={0.5}>
                          {Object.entries(inheritedProperties).map(([key, value]) => {
                            // no idea how to do this with TypeScript
                            return (
                              <Label
                                key={key}
                                // @ts-ignore
                                label={routePropertyToLabel(key)}
                                value={<Strong>{Array.isArray(value) ? value.join(', ') : value}</Strong>}
                              />
                            );
                          })}
                        </Stack>
                      }
                    >
                      <div>
                        <Strong>{pluralize('property', Object.keys(inheritedProperties).length, true)}</Strong>
                      </div>
                    </HoverCard>
                  </MetaText>
                </>
              )}
            </Stack>
          </div>
        </Stack>
      </div>
      <div className={styles.childPolicies}>
        {/* pass the "readOnly" prop from the parent, because if you can't edit the parent you can't edit children */}
        {childPolicies.map((route) => {
          // inherited properties are config properties that exist on the parent but not on currentRoute
          const inheritableProperties: InhertitableProperties = pick(currentRoute, [
            'receiver',
            'group_by',
            'group_wait',
            'group_interval',
            'repeat_interval',
            'mute_time_intervals',
          ]);

          // TODO how to solve this TypeScript mystery
          const inherited = merge(
            reduce(
              inheritableProperties,
              (acc: Partial<Route> = {}, value, key) => {
                // @ts-ignore
                if (value !== undefined && route[key] === undefined) {
                  // @ts-ignore
                  acc[key] = value;
                }

                return acc;
              },
              {}
            ),
            inheritedProperties
          );

          return (
            <Policy
              key={uniqueId()}
              currentRoute={route}
              receivers={receivers}
              contactPoint={route.receiver}
              contactPointsState={contactPointsState}
              groupBy={route.group_by}
              timingOptions={{
                group_wait: route.group_wait,
                group_interval: route.group_interval,
                repeat_interval: route.repeat_interval,
              }}
              readOnly={readOnly}
              matchers={normalizeMatchers(route)}
              muteTimings={route.mute_time_intervals}
              childPolicies={route.routes ?? []}
              continueMatching={route.continue}
              inheritedProperties={inherited}
              onAddPolicy={onAddPolicy}
              onEditPolicy={onEditPolicy}
              onDeletePolicy={onDeletePolicy}
              alertManagerSourceName={alertManagerSourceName}
            />
          );
        })}
      </div>
      <div className={styles.addPolicyWrapper(hasChildPolicies)}>
        <CreateOrAddPolicy
          onClick={() => onAddPolicy(currentRoute)}
          hasChildPolicies={hasChildPolicies}
          isDefaultPolicy={isDefaultPolicy}
        />
      </div>
    </Stack>
  );
};

type InhertitableProperties = Pick<
  Route,
  'receiver' | 'group_by' | 'group_wait' | 'group_interval' | 'repeat_interval' | 'mute_time_intervals'
>;

const routePropertyToLabel = (key: keyof InhertitableProperties): string => {
  switch (key) {
    case 'receiver':
      return 'Contact Point';
    case 'group_by':
      return 'Group by';
    case 'group_interval':
      return 'Group interval';
    case 'group_wait':
      return 'Group wait';
    case 'mute_time_intervals':
      return 'Mute timings';
    case 'repeat_interval':
      return 'Repeat interval';
  }
};

const TimingOptionsMeta = ({ timingOptions }: { timingOptions: TimingOptions }) => (
  <MetaText icon="hourglass">
    <span>Wait</span>
    {timingOptions.group_wait && (
      <Tooltip
        placement="top"
        content="How long to initially wait to send a notification for a group of alert instances."
      >
        <span>
          <Strong>{timingOptions.group_wait}</Strong> <span>to group instances</span>
          {timingOptions.group_interval && ', '}
        </span>
      </Tooltip>
    )}
    {timingOptions.group_interval && (
      <Tooltip
        placement="top"
        content="How long to wait before sending a notification about new alerts that are added to a group of alerts for which an initial notification has already been sent."
      >
        <span>
          <Strong>{timingOptions.group_interval}</Strong> <span>before sending updates</span>
        </span>
      </Tooltip>
    )}
  </MetaText>
);

interface MataTextProps {
  icon?: IconName;
}

const Strong: FC = ({ children }) => {
  const theme = useTheme2();
  return <strong style={{ color: theme.colors.text.maxContrast }}>{children}</strong>;
};

const MetaText: FC<MataTextProps> = ({ children, icon }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.metaText}>
      <Stack direction="row" alignItems="center" gap={0.5}>
        {icon && <Icon name={icon} />}
        {children}
      </Stack>
    </div>
  );
};

interface AddPolicyProps {
  onClick: () => void;
  hasChildPolicies?: boolean;
  isDefaultPolicy?: boolean;
}

const CreateOrAddPolicy: FC<AddPolicyProps> = ({ hasChildPolicies = true, isDefaultPolicy = false, onClick }) => (
  <Button
    type="button"
    variant={isDefaultPolicy ? 'primary' : 'secondary'}
    size={'sm'}
    fill={isDefaultPolicy ? 'solid' : 'outline'}
    icon={hasChildPolicies ? 'plus' : 'corner-down-right-alt'}
    onClick={onClick}
  >
    {hasChildPolicies ? 'Add policy' : 'Create nested policy'}
  </Button>
);

const wildcardRouteWarning = <Badge icon="exclamation-triangle" text="Matches all labels" color="orange" />;

type MatchersProps = { matchers: ObjectMatcher[] };

// renders the first N number of matchers
const Matchers: FC<MatchersProps> = ({ matchers }) => {
  const styles = useStyles2(getStyles);

  const NUM_MATCHERS = 5;

  const firstFew = take(matchers, NUM_MATCHERS);
  const rest = matchers.length - NUM_MATCHERS;
  const hasMoreMatchers = rest > 0;

  return (
    <Stack direction="row" gap={1} alignItems="center">
      {firstFew.map((matcher) => (
        <MatcherBadge key={uniqueId()} matcher={matcher} />
      ))}
      {/* TODO hover state to show all matchers we're not showing */}
      {hasMoreMatchers && <div className={styles.metadata}>{`and ${rest} more`}</div>}
    </Stack>
  );
};

interface LabelProps {
  icon?: IconName;
  label?: ReactNode;
  value: ReactNode;
  color?: string;
}

// TODO allow customization with color prop
const Label: FC<LabelProps> = ({ label, value, icon }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.meta().wrapper}>
      <Stack direction="row" gap={0} alignItems="stretch">
        <div className={styles.meta().label}>
          <Stack direction="row" gap={0.5} alignItems="center">
            {icon && <Icon name={icon} />} {label ?? ''}
          </Stack>
        </div>
        <div className={styles.meta().value}>{value}</div>
      </Stack>
    </div>
  );
};

interface MatcherBadgeProps {
  matcher: ObjectMatcher;
}

const MatcherBadge: FC<MatcherBadgeProps> = ({ matcher: [label, operator, value] }) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.matcher(label).wrapper}>
      <Stack direction="row" gap={0} alignItems="baseline">
        {label} {operator} {value}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  tabContent: css`
    margin-top: ${theme.spacing(2)};
  `,
  matcher: (label: string) => {
    const { color, borderColor } = getTagColorsFromName(label);

    return {
      wrapper: css`
        color: #fff;
        background: ${color};
        padding: ${theme.spacing(0.33)} ${theme.spacing(0.66)};
        font-size: ${theme.typography.bodySmall.fontSize};

        border: solid 1px ${borderColor};
        border-radius: ${theme.shape.borderRadius(2)};
      `,
    };
  },
  meta: (color?: string) => ({
    wrapper: css`
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    label: css`
      display: flex;
      align-items: center;

      padding: ${theme.spacing(0.33)} ${theme.spacing(1)};
      background: ${theme.colors.secondary.transparent};

      border: solid 1px ${theme.colors.border.medium};
      border-top-left-radius: ${theme.shape.borderRadius(2)};
      border-bottom-left-radius: ${theme.shape.borderRadius(2)};
    `,
    value: css`
      padding: ${theme.spacing(0.33)} ${theme.spacing(1)};
      font-weight: ${theme.typography.fontWeightBold};

      border: solid 1px ${theme.colors.border.medium};
      border-left: none;
      border-top-right-radius: ${theme.shape.borderRadius(2)};
      border-bottom-right-radius: ${theme.shape.borderRadius(2)};
    `,
  }),
  childPolicies: css`
    margin-left: ${theme.spacing(4)};
    position: relative;

    &:before {
      content: '';
      position: absolute;
      height: calc(100% - 10px);

      border-left: solid 1px ${theme.colors.border.weak};

      margin-top: 0;
      margin-left: -20px;
    }
  `,
  metadataRow: css`
    background: ${theme.colors.background.primary};
    padding: ${theme.spacing(1.5)};

    border-bottom-left-radius: ${theme.shape.borderRadius(2)};
    border-bottom-right-radius: ${theme.shape.borderRadius(2)};
  `,
  matchersRow: css`
    padding: ${theme.spacing(1.5)};
    border-bottom: solid 1px ${theme.colors.border.weak};
  `,
  policyWrapper: css`
    flex: 1;
    position: relative;
    background: ${theme.colors.background.secondary};

    border-radius: ${theme.shape.borderRadius(2)};
    border: solid 1px ${theme.colors.border.weak};
  `,
  metadata: css`
    color: ${theme.colors.text.secondary};

    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.bodySmall.fontWeight};
  `,
  break: css`
    width: 100%;
    height: 0;
    margin-bottom: ${theme.spacing(2)};
  `,
  // TODO I'm not quite sure why the margins are different for non-child policies, should investigate a bit more
  addPolicyWrapper: (hasChildPolicies: boolean) => css`
    margin-top: -${theme.spacing(hasChildPolicies ? 1.5 : 2)};
    margin-bottom: ${theme.spacing(1)};
  `,
  metaText: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    color: ${theme.colors.text.secondary};
  `,
  continueMatching: css`
    position: absolute;

    top: 0;
    transform: translateY(50%);
    left: -${theme.spacing(4)};

    color: ${theme.colors.text.secondary};
    background: ${theme.colors.background.primary};

    width: 25px;
    height: 25px;
    text-align: center;

    border: solid 1px ${theme.colors.border.weak};
    border-radius: ${theme.shape.borderRadius(2)};

    padding: 0;
  `,
});

export default withErrorBoundary(AmRoutes, { style: 'page' });

type ModalHook<T> = [JSX.Element, (item: T) => void, () => void];

const useAddPolicyModal = (
  receivers: Receiver[] = [],
  handleAdd: (route: Partial<FormAmRoute>, parentRoute: RouteWithID) => void,
  loading: boolean
): ModalHook<RouteWithID> => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [parentRoute, setParentRoute] = useState<RouteWithID>();
  const AmRouteReceivers = useGetAmRouteReceiverWithGrafanaAppTypes(receivers);

  const handleDismiss = useCallback(() => {
    setParentRoute(undefined);
    setShowModal(false);
  }, []);

  const handleShow = useCallback((parentRoute: RouteWithID) => {
    setParentRoute(parentRoute);
    setShowModal(true);
  }, []);

  const modalElement = useMemo(
    () =>
      loading ? (
        <UpdatingModal isOpen={showModal} />
      ) : (
        <Modal
          isOpen={showModal}
          onDismiss={handleDismiss}
          closeOnBackdropClick={true}
          closeOnEscape={true}
          title="Add notification policy"
        >
          <AmRoutesExpandedForm
            receivers={AmRouteReceivers}
            onSubmit={(newRoute) => parentRoute && handleAdd(newRoute, parentRoute)}
            actionButtons={
              <Modal.ButtonRow>
                <Button type="submit">Add policy</Button>
                <Button type="button" variant="secondary" onClick={handleDismiss}>
                  Cancel
                </Button>
              </Modal.ButtonRow>
            }
          />
        </Modal>
      ),
    [AmRouteReceivers, handleAdd, handleDismiss, loading, parentRoute, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};

const useEditPolicyModal = (
  alertManagerSourceName: string,
  receivers: Receiver[],
  handleSave: (route: Partial<FormAmRoute>) => void,
  loading: boolean
): ModalHook<RouteWithID> => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isDefaultPolicy, setIsDefaultPolicy] = useState<boolean>(false);
  const [route, setRoute] = useState<RouteWithID>();
  const AmRouteReceivers = useGetAmRouteReceiverWithGrafanaAppTypes(receivers);

  const handleDismiss = useCallback(() => {
    setRoute(undefined);
    setShowModal(false);
  }, []);

  const handleShow = useCallback((route: RouteWithID, isDefaultPolicy?: boolean) => {
    setIsDefaultPolicy(isDefaultPolicy ?? false);
    setRoute(route);
    setShowModal(true);
  }, []);

  const modalElement = useMemo(
    () =>
      loading ? (
        <UpdatingModal isOpen={showModal} />
      ) : (
        <Modal
          isOpen={showModal}
          onDismiss={handleDismiss}
          closeOnBackdropClick={true}
          closeOnEscape={true}
          title="Edit notification policy"
        >
          {isDefaultPolicy && route && (
            <AmRootRouteForm
              // TODO *sigh* this alertmanagersourcename should come from context or something
              // passing it down all the way here is a code smell
              alertManagerSourceName={alertManagerSourceName}
              onSubmit={handleSave}
              receivers={AmRouteReceivers}
              route={route}
              actionButtons={
                <Modal.ButtonRow>
                  <Button type="submit">Update default policy</Button>
                  <Button type="button" variant="secondary" onClick={handleDismiss}>
                    Cancel
                  </Button>
                </Modal.ButtonRow>
              }
            />
          )}
          {!isDefaultPolicy && (
            <AmRoutesExpandedForm
              receivers={AmRouteReceivers}
              route={route}
              onSubmit={handleSave}
              actionButtons={
                <Modal.ButtonRow>
                  <Button type="submit">Update policy</Button>
                  <Button type="button" variant="secondary" onClick={handleDismiss}>
                    Cancel
                  </Button>
                </Modal.ButtonRow>
              }
            />
          )}
        </Modal>
      ),
    [AmRouteReceivers, alertManagerSourceName, handleDismiss, handleSave, isDefaultPolicy, loading, route, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};

const useDeletePolicyModal = (handleDelete: (route: RouteWithID) => void, loading: boolean): ModalHook<RouteWithID> => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [route, setRoute] = useState<RouteWithID>();

  const handleDismiss = useCallback(() => {
    setRoute(undefined);
    setShowModal(false);
  }, [setRoute]);

  const handleShow = useCallback((route: RouteWithID) => {
    setRoute(route);
    setShowModal(true);
  }, []);

  const handleSubmit = useCallback(() => {
    if (route) {
      handleDelete(route);
    }
  }, [handleDelete, route]);

  const modalElement = useMemo(
    () =>
      loading ? (
        <UpdatingModal isOpen={showModal} />
      ) : (
        <Modal
          isOpen={showModal}
          onDismiss={handleDismiss}
          closeOnBackdropClick={true}
          closeOnEscape={true}
          title="Delete notification policy"
        >
          <p>Deleting this notification policy will permanently remove it.</p>
          <p>Are you sure you want to delete this policy?</p>

          <Modal.ButtonRow>
            <Button type="button" variant="destructive" onClick={handleSubmit}>
              Yes, delete policy
            </Button>
            <Button type="button" variant="secondary" onClick={handleDismiss}>
              Cancel
            </Button>
          </Modal.ButtonRow>
        </Modal>
      ),
    [handleDismiss, handleSubmit, loading, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};

interface ContactPointDetailsProps {
  alertManagerSourceName: string;
  contactPoint: string;
  receivers: Receiver[];
}

const INTEGRATION_ICONS: Record<string, IconName> = {
  discord: 'discord',
  email: 'envelope',
  googlechat: 'google-hangouts-alt',
  hipchat: 'hipchat',
  line: 'line',
  pagerduty: 'pagerduty',
  slack: 'slack',
  teams: 'microsoft',
  telegram: 'telegram-alt',
};

const ContactPointsHoverDetails = ({ alertManagerSourceName, contactPoint, receivers }: ContactPointDetailsProps) => {
  const details = receivers.find((receiver) => receiver.name === contactPoint);
  if (!details) {
    return (
      <Link to={createContactPointLink(contactPoint, alertManagerSourceName)}>
        <Strong>{contactPoint}</Strong>
      </Link>
    );
  }

  const integrations = details.grafana_managed_receiver_configs;
  if (!integrations) {
    return (
      <Link to={createContactPointLink(contactPoint, alertManagerSourceName)}>
        <Strong>{contactPoint}</Strong>
      </Link>
    );
  }

  const groupedIntegrations = groupBy(details.grafana_managed_receiver_configs, (config) => config.type);

  return (
    <HoverCard
      arrow
      placement="top"
      header={
        <MetaText icon="at">
          <div>Contact Point</div>
          <Strong>{contactPoint}</Strong>
        </MetaText>
      }
      key={uniqueId()}
      content={
        <Stack direction="row" gap={0.5}>
          {/* use "label" to indicate how many of that type we have in the contact point */}
          {Object.entries(groupedIntegrations).map(([type, integrations]) => (
            <Label
              key={uniqueId()}
              label={integrations.length > 1 ? integrations.length : undefined}
              icon={INTEGRATION_ICONS[type]}
              value={upperFirst(type)}
            />
          ))}
        </Stack>
      }
    >
      <Link to={createContactPointLink(contactPoint, alertManagerSourceName)}>
        <Strong>{contactPoint}</Strong>
      </Link>
    </HoverCard>
  );
};

const UpdatingModal: FC<Pick<ModalProps, 'isOpen'>> = ({ isOpen }) => (
  <Modal
    isOpen={isOpen}
    onDismiss={() => {}}
    closeOnBackdropClick={false}
    closeOnEscape={false}
    title={
      <Stack direction="row" alignItems="center" gap={0.5}>
        Updating... <Spinner inline />
      </Stack>
    }
  >
    Please wait while we update your notification policies.
  </Modal>
);

function createContactPointLink(contactPoint: string, alertManagerSourceName = ''): string {
  return `/alerting/notifications/receivers/${encodeURIComponent(contactPoint)}/edit?alertmanager=${encodeURIComponent(
    alertManagerSourceName
  )}`;
}
