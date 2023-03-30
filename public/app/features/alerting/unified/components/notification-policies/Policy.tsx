import { css } from '@emotion/css';
import { uniqueId, pick, groupBy, upperFirst, merge, reduce, sumBy } from 'lodash';
import pluralize from 'pluralize';
import React, { FC, Fragment, ReactNode, useMemo } from 'react';
import { useEnabled } from 'react-enable';
import { Link } from 'react-router-dom';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Badge, Button, Dropdown, getTagColorsFromName, Icon, Menu, Tooltip, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import {
  RouteWithID,
  Receiver,
  ObjectMatcher,
  Route,
  AlertmanagerGroup,
} from 'app/plugins/datasource/alertmanager/types';
import { ReceiversState } from 'app/types';

import { AlertingFeature } from '../../features';
import { getNotificationsPermissions } from '../../utils/access-control';
import { normalizeMatchers } from '../../utils/amroutes';
import { createContactPointLink, createMuteTimingLink } from '../../utils/misc';
import { findMatchingAlertGroups } from '../../utils/notification-policies';
import { HoverCard } from '../HoverCard';
import { Label } from '../Label';
import { MetaText } from '../MetaText';
import { Spacer } from '../Spacer';
import { Strong } from '../Strong';

import { Matchers } from './Matchers';
import { TimingOptions, TIMING_OPTIONS_DEFAULTS } from './timingOptions';

type InhertitableProperties = Pick<
  Route,
  'receiver' | 'group_by' | 'group_wait' | 'group_interval' | 'repeat_interval' | 'mute_time_intervals'
>;

interface PolicyComponentProps {
  receivers?: Receiver[];
  alertGroups?: AlertmanagerGroup[];
  contactPointsState?: ReceiversState;
  readOnly?: boolean;
  inheritedProperties?: InhertitableProperties;
  routesMatchingFilters?: RouteWithID[];

  routeTree: RouteWithID;
  currentRoute: RouteWithID;
  alertManagerSourceName: string;
  onEditPolicy: (route: RouteWithID, isDefault?: boolean) => void;
  onAddPolicy: (route: RouteWithID) => void;
  onDeletePolicy: (route: RouteWithID) => void;
  onShowAlertInstances: (alertGroups: AlertmanagerGroup[], matchers?: ObjectMatcher[]) => void;
}

const Policy: FC<PolicyComponentProps> = ({
  receivers = [],
  contactPointsState,
  readOnly = false,
  alertGroups = [],
  alertManagerSourceName,
  currentRoute,
  routeTree,
  inheritedProperties,
  routesMatchingFilters = [],
  onEditPolicy,
  onAddPolicy,
  onDeletePolicy,
  onShowAlertInstances,
}) => {
  const styles = useStyles2(getStyles);
  const isDefaultPolicy = currentRoute === routeTree;
  const showMatchingInstances = useEnabled(AlertingFeature.NotificationPoliciesV2MatchingInstances);

  const permissions = getNotificationsPermissions(alertManagerSourceName);
  const canEditRoutes = contextSrv.hasPermission(permissions.update);
  const canDeleteRoutes = contextSrv.hasPermission(permissions.delete);

  const contactPoint = currentRoute.receiver;
  const continueMatching = currentRoute.continue ?? false;
  const groupBy = currentRoute.group_by ?? [];
  const muteTimings = currentRoute.mute_time_intervals ?? [];
  const timingOptions: TimingOptions = {
    group_wait: currentRoute.group_wait,
    group_interval: currentRoute.group_interval,
    repeat_interval: currentRoute.repeat_interval,
  };

  const matchers = normalizeMatchers(currentRoute);
  const hasMatchers = Boolean(matchers && matchers.length);
  const hasMuteTimings = Boolean(muteTimings.length);
  const hasFocus = routesMatchingFilters.some((route) => route.id === currentRoute.id);

  // gather errors here
  const errors: ReactNode[] = [];

  // if the route has no matchers, is not the default policy (that one has none) and it does not continue
  // then we should warn the user that it's a suspicious setup
  const showMatchesAllLabelsWarning = !hasMatchers && !isDefaultPolicy && !continueMatching;

  // if the receiver / contact point has any errors show it on the policy
  const actualContactPoint = contactPoint ?? inheritedProperties?.receiver ?? '';
  const contactPointErrors = contactPointsState ? getContactPointErrors(actualContactPoint, contactPointsState) : [];

  contactPointErrors.forEach((error) => {
    errors.push(error);
  });

  const childPolicies = currentRoute.routes ?? [];
  const isGrouping = Array.isArray(groupBy) && groupBy.length > 0;
  const hasInheritedProperties = inheritedProperties && Object.keys(inheritedProperties).length > 0;

  const isEditable = canEditRoutes;
  const isDeletable = canDeleteRoutes && !isDefaultPolicy;

  const matchingAlertGroups = useMemo(() => {
    return showMatchingInstances ? findMatchingAlertGroups(routeTree, currentRoute, alertGroups) : [];
  }, [alertGroups, currentRoute, routeTree, showMatchingInstances]);

  // sum all alert instances for all groups we're handling
  const numberOfAlertInstances = sumBy(matchingAlertGroups, (group) => group.alerts.length);

  // TODO dead branch detection, warnings for all sort of configs that won't work or will never be activated
  return (
    <Stack direction="column" gap={1.5}>
      <div
        className={styles.policyWrapper(hasFocus)}
        data-testid={isDefaultPolicy ? 'am-root-route-container' : 'am-route-container'}
      >
        {/* continueMatching and showMatchesAllLabelsWarning are mutually exclusive so the icons can't overlap */}
        {continueMatching && <ContinueMatchingIndicator />}
        {showMatchesAllLabelsWarning && <AllMatchesIndicator />}
        <Stack direction="column" gap={0}>
          {/* Matchers and actions */}
          <div className={styles.matchersRow}>
            <Stack direction="row" alignItems="center" gap={1}>
              {isDefaultPolicy ? (
                <DefaultPolicyIndicator />
              ) : hasMatchers ? (
                <Matchers matchers={matchers ?? []} />
              ) : (
                <span className={styles.metadata}>No matchers</span>
              )}
              <Spacer />
              {/* TODO maybe we should move errors to the gutter instead? */}
              {errors.length > 0 && <Errors errors={errors} />}
              {!readOnly && (
                <Stack direction="row" gap={0.5}>
                  <Button
                    variant="secondary"
                    icon="plus"
                    size="sm"
                    onClick={() => onAddPolicy(currentRoute)}
                    type="button"
                  >
                    New nested policy
                  </Button>
                  <Dropdown
                    overlay={
                      <Menu>
                        <Menu.Item
                          icon="pen"
                          disabled={!isEditable}
                          label="Edit"
                          onClick={() => onEditPolicy(currentRoute, isDefaultPolicy)}
                        />
                        {isDeletable && (
                          <>
                            <Menu.Divider />
                            <Menu.Item
                              destructive
                              icon="trash-alt"
                              label="Delete"
                              onClick={() => onDeletePolicy(currentRoute)}
                            />
                          </>
                        )}
                      </Menu>
                    }
                  >
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="ellipsis-h"
                      type="button"
                      aria-label="more-actions"
                      data-testid="more-actions"
                    />
                  </Dropdown>
                </Stack>
              )}
            </Stack>
          </div>

          {/* Metadata row */}
          <div className={styles.metadataRow}>
            <Stack direction="row" alignItems="center" gap={1}>
              {showMatchingInstances && (
                <MetaText
                  icon="layers-alt"
                  onClick={() => {
                    onShowAlertInstances(matchingAlertGroups, matchers);
                  }}
                  data-testid="matching-instances"
                >
                  <Strong>{numberOfAlertInstances}</Strong>
                  <span>{pluralize('instance', numberOfAlertInstances)}</span>
                </MetaText>
              )}
              {contactPoint && (
                <MetaText icon="at" data-testid="contact-point">
                  <span>Delivered to</span>
                  <ContactPointsHoverDetails
                    alertManagerSourceName={alertManagerSourceName}
                    receivers={receivers}
                    contactPoint={contactPoint}
                  />
                </MetaText>
              )}
              {isGrouping && (
                <MetaText icon="layer-group" data-testid="grouping">
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
                <MetaText icon="calendar-slash" data-testid="mute-timings">
                  <span>Muted when</span>
                  <MuteTimings timings={muteTimings} alertManagerSourceName={alertManagerSourceName} />
                </MetaText>
              )}
              {timingOptions && Object.values(timingOptions).some(Boolean) && (
                <TimingOptionsMeta timingOptions={timingOptions} />
              )}
              {hasInheritedProperties && (
                <>
                  <MetaText icon="corner-down-right-alt" data-testid="inherited-properties">
                    <span>Inherited</span>
                    <InheritedProperties properties={inheritedProperties} />
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
              routeTree={routeTree}
              currentRoute={route}
              receivers={receivers}
              contactPointsState={contactPointsState}
              readOnly={readOnly}
              inheritedProperties={inherited}
              onAddPolicy={onAddPolicy}
              onEditPolicy={onEditPolicy}
              onDeletePolicy={onDeletePolicy}
              onShowAlertInstances={onShowAlertInstances}
              alertManagerSourceName={alertManagerSourceName}
              alertGroups={alertGroups}
              routesMatchingFilters={routesMatchingFilters}
            />
          );
        })}
      </div>
    </Stack>
  );
};

const Errors: FC<{ errors: React.ReactNode[] }> = ({ errors }) => (
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
);

const ContinueMatchingIndicator: FC = () => {
  const styles = useStyles2(getStyles);
  return (
    <Tooltip placement="top" content="This route will continue matching other policies">
      <div className={styles.gutterIcon} data-testid="continue-matching">
        <Icon name="arrow-down" />
      </div>
    </Tooltip>
  );
};

const AllMatchesIndicator: FC = () => {
  const styles = useStyles2(getStyles);
  return (
    <Tooltip placement="top" content="This policy matches all labels">
      <div className={styles.gutterIcon} data-testid="matches-all">
        <Icon name="exclamation-triangle" />
      </div>
    </Tooltip>
  );
};

const DefaultPolicyIndicator: FC = () => {
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

const InheritedProperties: FC<{ properties: InhertitableProperties }> = ({ properties }) => (
  <HoverCard
    arrow
    placement="top"
    content={
      <Stack direction="row" gap={0.5}>
        {Object.entries(properties).map(([key, value]) => {
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
      <Strong>{pluralize('property', Object.keys(properties).length, true)}</Strong>
    </div>
  </HoverCard>
);

const MuteTimings: FC<{ timings: string[]; alertManagerSourceName: string }> = ({
  timings,
  alertManagerSourceName,
}) => {
  /* TODO make a better mute timing overview, allow combining multiple in to one overview */
  /*
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
  */
  return (
    <div>
      <Strong>
        {timings.map((timing) => (
          <Link key={timing} to={createMuteTimingLink(timing, alertManagerSourceName)}>
            {timing}
          </Link>
        ))}
      </Strong>
    </div>
  );
};

const TimingOptionsMeta: FC<{ timingOptions: TimingOptions }> = ({ timingOptions }) => {
  const groupWait = timingOptions.group_wait ?? TIMING_OPTIONS_DEFAULTS.group_wait;
  const groupInterval = timingOptions.group_interval ?? TIMING_OPTIONS_DEFAULTS.group_interval;

  return (
    <MetaText icon="hourglass" data-testid="timing-options">
      <span>Wait</span>
      <Tooltip
        placement="top"
        content="How long to initially wait to send a notification for a group of alert instances."
      >
        <span>
          <Strong>{groupWait}</Strong> <span>to group instances</span>,
        </span>
      </Tooltip>
      <Tooltip
        placement="top"
        content="How long to wait before sending a notification about new alerts that are added to a group of alerts for which an initial notification has already been sent."
      >
        <span>
          <Strong>{groupInterval}</Strong> <span>before sending updates</span>
        </span>
      </Tooltip>
    </MetaText>
  );
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

const ContactPointsHoverDetails: FC<ContactPointDetailsProps> = ({
  alertManagerSourceName,
  contactPoint,
  receivers,
}) => {
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

function getContactPointErrors(contactPoint: string, contactPointsState: ReceiversState): JSX.Element[] {
  const notifierStates = Object.entries(contactPointsState[contactPoint]?.notifiers ?? []);
  const contactPointErrors = notifierStates.reduce((acc: JSX.Element[] = [], [_, notifierStatuses]) => {
    const notifierErrors = notifierStatuses
      .filter((status) => status.lastNotifyAttemptError)
      .map((status) => (
        <Label
          icon="at"
          key={uniqueId()}
          label={`Contact Point › ${status.name}`}
          value={status.lastNotifyAttemptError}
        />
      ));

    return acc.concat(notifierErrors);
  }, []);

  return contactPointErrors;
}

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
  policyWrapper: (hasFocus = false) => css`
    flex: 1;
    position: relative;
    background: ${theme.colors.background.secondary};

    border-radius: ${theme.shape.borderRadius(2)};
    border: solid 1px ${theme.colors.border.weak};

    ${hasFocus &&
    css`
      border-color: ${theme.colors.primary.border};
    `}
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
  gutterIcon: css`
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

export { Policy };
