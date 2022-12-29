import { css } from '@emotion/css';
import { take, uniqueId } from 'lodash';
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
  Tooltip,
  useStyles2,
  useTheme2,
  withErrorBoundary,
} from '@grafana/ui';
import { MatcherOperator, ObjectMatcher } from 'app/plugins/datasource/alertmanager/types';
import { useDispatch } from 'app/types';

import { useCleanup } from '../../../core/hooks/useCleanup';

import { alertmanagerApi } from './api/alertmanagerApi';
import { AlertManagerPicker } from './components/AlertManagerPicker';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { GrafanaAlertmanagerDeliveryWarning } from './components/GrafanaAlertmanagerDeliveryWarning';
import { HoverCard } from './components/HoverCard';
import { NoAlertManagerWarning } from './components/NoAlertManagerWarning';
import { ProvisionedResource, ProvisioningAlert } from './components/Provisioning';
import { AmRootRoute } from './components/amroutes/AmRootRoute';
import { AmSpecificRouting } from './components/amroutes/AmSpecificRouting';
import { MuteTimingsTable } from './components/amroutes/MuteTimingsTable';
import { useGetAmRouteReceiverWithGrafanaAppTypes } from './components/receivers/grafanaAppReceivers/grafanaApp';
import { AmRouteReceiver } from './components/receivers/grafanaAppReceivers/types';
import { useAlertManagerSourceName } from './hooks/useAlertManagerSourceName';
import { useAlertManagersByPermission } from './hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchAlertGroupsAction, fetchAlertManagerConfigAction, updateAlertManagerConfigAction } from './state/actions';
import { FormAmRoute } from './types/amroutes';
import { matcherToOperator } from './utils/alertmanager';
import { amRouteToFormAmRoute, formAmRouteToAmRoute } from './utils/amroutes';
import { isVanillaPrometheusAlertManagerDataSource } from './utils/datasource';
import { initialAsyncRequestState } from './utils/redux';

const AmRoutes = () => {
  const dispatch = useDispatch();
  const { useGetAlertmanagerChoiceQuery } = alertmanagerApi;
  const [isRootRouteEditMode, setIsRootRouteEditMode] = useState(false);
  const alertManagers = useAlertManagersByPermission('notification');
  const [alertManagerSourceName, setAlertManagerSourceName] = useAlertManagerSourceName(alertManagers);
  const { currentData: alertmanagerChoice } = useGetAlertmanagerChoiceQuery();

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
  const [rootRoute, id2ExistingRoute] = useMemo(() => amRouteToFormAmRoute(config?.route), [config?.route]);

  const receivers: AmRouteReceiver[] = useGetAmRouteReceiverWithGrafanaAppTypes(config?.receivers ?? []);

  const isProvisioned = useMemo(() => Boolean(config?.route?.provenance), [config?.route]);

  const alertGroups = useUnifiedAlertingSelector((state) => state.amAlertGroups);
  const fetchAlertGroups = alertGroups[alertManagerSourceName || ''] ?? initialAsyncRequestState;

  const enterRootRouteEditMode = () => {
    setIsRootRouteEditMode(true);
  };

  const exitRootRouteEditMode = () => {
    setIsRootRouteEditMode(false);
  };

  useCleanup((state) => (state.unifiedAlerting.saveAMConfig = initialAsyncRequestState));

  // fetch AM instances grouping
  useEffect(() => {
    if (alertManagerSourceName) {
      dispatch(fetchAlertGroupsAction(alertManagerSourceName));
    }
  }, [alertManagerSourceName, dispatch]);

  const handleSave = (data: Partial<FormAmRoute>) => {
    if (!result) {
      return;
    }

    const newData = formAmRouteToAmRoute(
      alertManagerSourceName,
      {
        ...rootRoute,
        ...data,
      },
      id2ExistingRoute
    );

    if (isRootRouteEditMode) {
      exitRootRouteEditMode();
    }

    dispatch(
      updateAlertManagerConfigAction({
        newConfig: {
          ...result,
          alertmanager_config: {
            ...result.alertmanager_config,
            route: newData,
          },
        },
        oldConfig: result,
        alertManagerSourceName: alertManagerSourceName!,
        successMessage: 'Saved',
        refetch: true,
      })
    )
      .unwrap()
      .then(() => {
        if (alertManagerSourceName) {
          dispatch(fetchAlertGroupsAction(alertManagerSourceName));
        }
      })
      .catch(() => {
        // error is handling by a popup notification
      });
  };

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
      <GrafanaAlertmanagerDeliveryWarning
        currentAlertmanager={alertManagerSourceName}
        alertmanagerChoice={alertmanagerChoice}
      />
      {isProvisioned && <ProvisioningAlert resource={ProvisionedResource.RootNotificationPolicy} />}
      {resultLoading && <LoadingPlaceholder text="Loading Alertmanager config..." />}
      {result && !resultLoading && !resultError && (
        <Policy
          numberOfInstances={25}
          isDefault
          contactPoint="grafana-default-email"
          groupBy={['alertname', 'grafana_folder']}
          timingOptions={{
            group_wait: '30s',
            group_interval: '5m',
            repeat_interval: '4h',
          }}
        >
          <Policy
            numberOfInstances={4}
            continueMatching
            matchers={[
              ['team', MatcherOperator.equal, 'operations'],
              ['severity', MatcherOperator.notEqual, 'critical'],
            ]}
            muteTimings={['weekends']}
            contactPoint="grafana-default-email"
          >
            <Policy
              numberOfInstances={1}
              matchers={[['region', MatcherOperator.equal, 'europe']]}
              contactPoint="Slack"
            />
          </Policy>
          <Policy numberOfInstances={0} matchers={[['foo', MatcherOperator.equal, 'bar']]} continueMatching />
          <Policy matchers={[]} />
        </Policy>
      )}
      {/* {result && !resultLoading && !resultError && (
        <>
          <AmRootRoute
            readOnly={readOnly}
            alertManagerSourceName={alertManagerSourceName}
            isEditMode={isRootRouteEditMode}
            onSave={handleSave}
            onEnterEditMode={enterRootRouteEditMode}
            onExitEditMode={exitRootRouteEditMode}
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
            onRootRouteEdit={enterRootRouteEditMode}
            receivers={receivers}
            routes={rootRoute}
            routeTree={config?.route}
            alertGroups={fetchAlertGroups.result ?? []}
          />
          <div className={styles.break} />
          <MuteTimingsTable alertManagerSourceName={alertManagerSourceName} />
        </>
      )} */}
    </AlertingPageWrapper>
  );
};

interface PolicyComponentProps {
  isDefault?: boolean;
  matchers?: ObjectMatcher[];
  numberOfInstances?: number;
  contactPoint?: string;
  groupBy?: string[];
  muteTimings?: string[];
  readOnly?: boolean;
  timingOptions?: {
    group_wait: string;
    group_interval: string;
    repeat_interval: string;
  };
  continueMatching?: boolean;
}

const allRoutes = <Badge icon="exclamation-triangle" text="Matches all labels" color="orange" />;

const Policy: FC<PolicyComponentProps> = ({
  children,
  isDefault,
  matchers,
  numberOfInstances = 0,
  contactPoint,
  groupBy,
  muteTimings = [],
  timingOptions,
  readOnly = false,
  continueMatching,
}) => {
  const styles = useStyles2(getStyles);
  const isDefaultPolicy = isDefault !== undefined;

  const hasMatchers = Boolean(matchers && matchers.length);
  const hasMuteTimings = Boolean(muteTimings.length);

  const matchingLabels = isDefaultPolicy ? (
    <DefaultPolicy />
  ) : hasMatchers ? (
    <Matchers matchers={matchers ?? []} />
  ) : (
    <span className={styles.metadata}>No matchers</span>
  );

  // gather warnings here
  const warnings: ReactNode[] = [];
  if (!hasMatchers && !isDefaultPolicy) {
    warnings.push(allRoutes);
  }
  if (!contactPoint) {
    warnings.push(<NoContactPoint />);
  }

  // TODO dead branch detection, warnings for all sort of configs that won't work or will never be activated

  return (
    <Stack direction="column" gap={1.5}>
      <div className={styles.policyWrapper}>
        {continueMatching !== undefined && (
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
              {matchingLabels}
              <Spacer />
              {/* TODO show details for multiple warning, also show errors from contact points if possible */}
              {warnings.length === 1 && warnings[0]}
              {warnings.length > 1 && (
                <Badge icon="exclamation-triangle" color="orange" text={pluralize('warning', warnings.length, true)} />
              )}
              {!readOnly && (
                <div>
                  <Button variant="secondary" icon="pen" size="sm">
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
                    <Link to={`/alerting/notifications/receivers/${contactPoint}/edit?alertmanager=`}>
                      <Strong>{contactPoint}</Strong>
                    </Link>
                  </HoverCard>
                </MetaText>
              )}
              {groupBy && (
                <MetaText icon="layer-group">
                  <span>Grouped by</span>
                  <Strong>{groupBy.join(', ')}</Strong>
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
              {timingOptions && (
                <MetaText icon="hourglass">
                  <Tooltip
                    placement="top"
                    content="How long to initially wait to send a notification for a group of alert instances."
                  >
                    <span>
                      <span>Wait</span> <Strong>{timingOptions.group_wait}</Strong> <span>to group instances</span>
                    </span>
                  </Tooltip>

                  <Tooltip
                    placement="top"
                    content="How long to wait before sending a notification about new alerts that are added to a group of alerts for which an initial notification has already been sent."
                  >
                    <span>
                      <span>,</span> <Strong>{timingOptions.group_interval}</Strong> <span>before sending updates</span>
                    </span>
                  </Tooltip>
                </MetaText>
              )}
            </Stack>
          </div>
        </Stack>
      </div>
      <div className={styles.childPolicies}>{children}</div>
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

const DefaultPolicy = () => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <strong>Default policy</strong>
      <span className={styles.metadata}>
        All alert instances will be handled by the default policy if no other matching policies are found.
      </span>
    </>
  );
};

const AddPolicy = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.addPolicy}>
      <Button variant="secondary" size="sm" icon="plus">
        Add policy
      </Button>
    </div>
  );
};

const NoContactPoint = () => {
  return <Badge icon="exclamation-triangle" text="No contact point" color="orange" />;
};

type MatchersProps = { matchers: ObjectMatcher[] };

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

export default withErrorBoundary(AmRoutes, { style: 'page' });

const getStyles = (theme: GrafanaTheme2) => ({
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
  addPolicy: css`
    margin-bottom: ${theme.spacing(2)};
    margin-left: ${theme.spacing(2)};
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

const Spacer = () => <div style={{ flex: 1 }} />;
