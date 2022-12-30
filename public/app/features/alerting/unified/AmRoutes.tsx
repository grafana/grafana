import { css } from '@emotion/css';
import { pick, take, uniqueId } from 'lodash';
import pluralize from 'pluralize';
import React, { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
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
  Tab,
  TabContent,
  TabsBar,
  Tooltip,
  useStyles2,
  useTheme2,
  withErrorBoundary,
} from '@grafana/ui';
import { ObjectMatcher, Receiver, Route } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useCleanup } from '../../../core/hooks/useCleanup';

import { alertmanagerApi } from './api/alertmanagerApi';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import { HoverCard } from './components/HoverCard';
import { NoAlertManagerWarning } from './components/NoAlertManagerWarning';
import { ProvisionedResource, ProvisioningAlert } from './components/Provisioning';
import { Spacer } from './components/Spacer';
import { AmRoutesExpandedForm } from './components/amroutes/AmRoutesExpandedForm';
import { MuteTimingsTable } from './components/amroutes/MuteTimingsTable';
import { useGetAmRouteReceiverWithGrafanaAppTypes } from './components/receivers/grafanaAppReceivers/grafanaApp';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from './hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertGroupsAction, fetchAlertManagerConfigAction, updateAlertManagerConfigAction } from './state/actions';
import { normalizeMatchers } from './utils/amroutes';
import { isVanillaPrometheusAlertManagerDataSource } from './utils/datasource';
import { initialAsyncRequestState } from './utils/redux';

enum ActiveTab {
  NotificationPolicies,
  MuteTimings,
}

const AmRoutes = () => {
  const dispatch = useDispatch();
  const styles = useStyles2(getStyles);
  // TODO add querystring param for the current tab so we can route to it immediately
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.NotificationPolicies);

  const { useGetAlertmanagerChoiceQuery } = alertmanagerApi;
  const { currentData: alertmanagerChoice } = useGetAlertmanagerChoiceQuery();

  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName(alertManagers);

  const amConfigs = useUnifiedAlertingSelector((state) => state.amConfigs);

  const fetchConfig = useCallback(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertManagerConfigAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const {
    result,
    loading: resultLoading,
    error: resultError,
  } = (alertManagerSourceName && amConfigs[alertManagerSourceName]) || initialAsyncRequestState;

  const config = result?.alertmanager_config;
  const rootRoute = config?.route;

  const isProvisioned = useMemo(() => Boolean(config?.route?.provenance), [config?.route]);

  // const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups);
  // const fetchAlertGroups = alertGroups[alertManagerSourceName || ''] ?? initialAsyncRequestState;

  const receivers = config?.receivers ?? [];
  const [addModal, openAddModal] = useAddPolicyModal(receivers);
  const [editModal, openEditModal] = useEditPolicyModal(receivers);

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));

  // fetch AM instances grouping
  useEffect(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertGroupsAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  // const handleSave = (data: Partial<FormAmRoute>) => {
  //   if (!result) {
  //     return;
  //   }

  //   const newData = formAmRouteToAmRoute(
  //     alertManagerSourceName,
  //     {
  //       ...rootRoute,
  //       ...data,
  //     },
  //     id2ExistingRoute
  //   );

  //   dispatch(
  //     updateAlertManagerConfigAction({
  //       newConfig: {
  //         ...result,
  //         alertmanager_config: {
  //           ...result.alertmanager_config,
  //           route: newData,
  //         },
  //       },
  //       oldConfig: result,
  //       alertManagerSourceName: alertManagerSourceName!,
  //       successMessage: 'Updated notification policies',
  //       refetch: true,
  //     })
  //   )
  //     .unwrap()
  //     .then(() => {
  //       if (alertManagerSourceName) {
  //         dispatch(fetchAlertGroupsAction(alertManagerSourceName));
  //       }
  //     })
  //     .catch(() => {
  //       // error is handled by a popup notification
  //     });
  // };

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

  return (
    <AlertingPageWrapper pageId="am-routes">
      <AlertManagerPicker
        current={alertManagerSourceName}
        onChange={setAlertManagerSourceName}
        dataSources={alertManagers}
      />
      {resultError && !resultLoading && (
        <Alert severity="error" title="Error loading Alertmanager config">
          {resultError.message || 'Unknown error.'}
        </Alert>
      )}
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
        {activeTab === ActiveTab.MuteTimings && <Button type="button">Add mute timing</Button>}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {activeTab === ActiveTab.NotificationPolicies && (
          <>
            <GrafanaAlertmanagerDeliveryWarning
              currentAlertmanager={alertManagerSourceName}
              alertmanagerChoice={alertmanagerChoice}
            />
            {isProvisioned && <ProvisioningAlert resource={ProvisionedResource.RootNotificationPolicy} />}
            {resultLoading && <LoadingPlaceholder text="Loading Alertmanager config..." />}
            {result && rootRoute && !resultLoading && !resultError && (
              <Policy
                isDefault
                receivers={receivers}
                currentRoute={rootRoute}
                contactPoint={rootRoute.receiver}
                groupBy={rootRoute.group_by}
                timingOptions={pick(rootRoute, ['group_wait', 'group_interval', 'repeat_interval'])}
                readOnly={readOnly}
                matchers={normalizeMatchers(rootRoute)}
                muteTimings={rootRoute.mute_time_intervals}
                childPolicies={rootRoute.routes ?? []}
                continueMatching={rootRoute.continue}
                alertManagerSourceName={alertManagerSourceName}
                onAddPolicy={openAddModal}
                onEditPolicy={openEditModal}
              />
            )}
            {addModal}
            {editModal}
          </>
        )}
        {activeTab === ActiveTab.MuteTimings && <MuteTimingsTable alertManagerSourceName={alertManagerSourceName} />}
      </TabContent>
      {/* {result && !resultLoading && !resultError && (
        <>
          <AmRootRoute
            readOnly={readOnly}
            alertManagerSourceName={alertManagerSourceName}
            onSave={handleSave}
            receivers={receivers}
            routes={rootRoute}
            routeTree={config?.route}
            alertGroups={fetchAlertGroups.result ?? []}
          />
          <div className={styles.break} />
          <AmSpecificRouting
            alertManagerSourceName={alertManagerSourceName}
            onChange={handleSave}
            readOnly={readOnly}
            receivers={receivers}
            routes={rootRoute}
            routeTree={config?.route}
            alertGroups={fetchAlertGroups.result ?? []}
          />
        </>
      )} */}
    </AlertingPageWrapper>
  );
};

interface PolicyComponentProps {
  childPolicies: Route[];
  receivers: Receiver[];
  isDefault?: boolean;
  matchers?: ObjectMatcher[];
  numberOfInstances?: number;
  contactPoint?: string;
  groupBy?: string[];
  muteTimings?: string[];
  readOnly?: boolean;
  timingOptions?: {
    group_wait?: string;
    group_interval?: string;
    repeat_interval?: string;
  };
  continueMatching?: boolean;
  alertManagerSourceName?: string;

  currentRoute: Route;
  onEditPolicy: (route: Route) => void;
  onAddPolicy: (route: Route) => void;
}

const Policy: FC<PolicyComponentProps> = ({
  childPolicies,
  receivers,
  isDefault,
  matchers,
  numberOfInstances = 0,
  contactPoint,
  groupBy,
  muteTimings = [],
  timingOptions,
  readOnly = true,
  continueMatching = false,
  alertManagerSourceName,
  currentRoute,
  onEditPolicy,
  onAddPolicy,
}) => {
  const styles = useStyles2(getStyles);
  const isDefaultPolicy = isDefault !== undefined;

  const hasMatchers = Boolean(matchers && matchers.length);
  const hasMuteTimings = Boolean(muteTimings.length);

  // gather warnings here
  const warnings: ReactNode[] = [];
  if (!hasMatchers && !isDefaultPolicy) {
    warnings.push(wildcardRouteWarning);
  }
  if (!contactPoint) {
    warnings.push(noContactPointWarning);
  }

  const hasChildPolicies = Boolean(childPolicies.length);
  const isGrouping = Array.isArray(groupBy) && groupBy.length > 0;

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
              {/* TODO show details for multiple warning, also show errors from contact points if possible */}
              {warnings.length === 1 && warnings[0]}
              {warnings.length > 1 && (
                <Badge icon="exclamation-triangle" color="orange" text={pluralize('warning', warnings.length, true)} />
              )}
              {!readOnly && (
                <div>
                  <Button
                    variant="secondary"
                    icon="pen"
                    size="sm"
                    onClick={() => onEditPolicy(currentRoute)}
                    type="button"
                  >
                    Edit
                  </Button>
                </div>
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
                  <HoverCard
                    arrow
                    placement="top"
                    header={
                      <MetaText icon="at">
                        <div>Contact Point</div>
                        <Strong>{contactPoint}</Strong>
                      </MetaText>
                    }
                    content={
                      <Stack direction="row" gap={0.5}>
                        {/* use "label" to indicate how many of that type we have in the contact point */}
                        <Label label={2} icon="envelope" value="Email" />
                        <Label icon="slack" value="Slack" />
                      </Stack>
                    }
                  >
                    <Link to={createContactPointLink(contactPoint, alertManagerSourceName)}>
                      <Strong>{contactPoint}</Strong>
                    </Link>
                  </HoverCard>
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
                <MetaText icon="hourglass">
                  <span>Wait</span>
                  {timingOptions.group_wait && (
                    <Tooltip
                      placement="top"
                      content="How long to initially wait to send a notification for a group of alert instances."
                    >
                      <span>
                        <Strong>{timingOptions.group_wait}</Strong> <span>to group instances</span>
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
              )}
            </Stack>
          </div>
        </Stack>
      </div>
      <div className={styles.childPolicies}>
        {/* pass the "readOnly" prop from the parent, because if you can't edit the parent you can't edit children */}
        {childPolicies.map((route) => (
          <Policy
            key={uniqueId()}
            currentRoute={route}
            receivers={receivers}
            contactPoint={route.receiver}
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
            onAddPolicy={onAddPolicy}
            onEditPolicy={onEditPolicy}
          />
        ))}
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
const noContactPointWarning = <Badge icon="exclamation-triangle" text="No contact point" color="orange" />;

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

function createContactPointLink(contactPoint: string, alertManagerSourceName: string | undefined): string {
  return `/alerting/notifications/receivers/${contactPoint}/edit?alertmanager=${alertManagerSourceName}`;
}

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

const useAddPolicyModal = (receivers: Receiver[] = []): ModalHook<Route> => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [route, setRoute] = useState<Route>();
  const AmRouteReceivers = useGetAmRouteReceiverWithGrafanaAppTypes(receivers);

  const handleDismiss = useCallback(() => {
    setRoute(undefined);
    setShowModal(false);
  }, []);

  const handleShow = useCallback((route: Route) => {
    setRoute(route);
    setShowModal(true);
  }, []);

  const modalElement = useMemo(
    () => (
      <Modal
        isOpen={showModal}
        onDismiss={handleDismiss}
        closeOnBackdropClick={true}
        closeOnEscape={true}
        title="Add a notification Policy"
      >
        <AmRoutesExpandedForm receivers={AmRouteReceivers} />
        <Modal.ButtonRow>
          <Button type="submit">Add policy</Button>
          <Button type="button" variant="secondary" onClick={handleDismiss}>
            Cancel
          </Button>
        </Modal.ButtonRow>
      </Modal>
    ),
    [AmRouteReceivers, handleDismiss, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};

const useEditPolicyModal = (receivers: Receiver[]): ModalHook<Route> => {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [route, setRoute] = useState<Route>();
  const AmRouteReceivers = useGetAmRouteReceiverWithGrafanaAppTypes(receivers);

  const handleDismiss = useCallback(() => {
    setRoute(undefined);
    setShowModal(false);
  }, []);

  const handleShow = useCallback((route: Route) => {
    setRoute(route);
    setShowModal(true);
  }, []);

  const modalElement = useMemo(
    () => (
      <Modal
        isOpen={showModal}
        onDismiss={handleDismiss}
        closeOnBackdropClick={true}
        closeOnEscape={true}
        title="Edit notification Policy"
      >
        <AmRoutesExpandedForm receivers={AmRouteReceivers} route={route} />
        <Modal.ButtonRow>
          <Button type="submit">Update policy</Button>
          <Button type="button" variant="secondary" onClick={handleDismiss}>
            Cancel
          </Button>
        </Modal.ButtonRow>
      </Modal>
    ),
    [AmRouteReceivers, handleDismiss, route, showModal]
  );

  return [modalElement, handleShow, handleDismiss];
};
