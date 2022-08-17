import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Icon, LoadingPlaceholder, Stack, Tag, TagList, Tooltip, useStyles2 } from '@grafana/ui';
import { Matcher, Receiver, Route } from 'app/plugins/datasource/alertmanager/types';

import { Labels } from '../../../../../types/unified-alerting-dto';
import { useAlertManagersByPermission } from '../../hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction } from '../../state/actions';
import {
  getLabelsMatchingMatcher,
  labelsMatchMatchers,
  matcherToMatcherField,
  objectMatcherToMatcher,
} from '../../utils/alertmanager';
import { AlertManagerPicker } from '../AlertManagerPicker';

interface AmAlertPreviewProps {
  alertLabels: Labels;
}

export function AmAlertPreview({ alertLabels }: AmAlertPreviewProps) {
  const dispatch = useDispatch();
  const styles = useStyles2(getRouteLabelsMatchStyles);

  const alertManagers = useAlertManagersByPermission('notification');
  const [alertmanagerName, setAlertmanagerName] = useState<string | undefined>(alertManagers[0]?.name);

  const amConfigState = useAsync(async () => {
    if (alertmanagerName) {
      await dispatch(fetchAlertManagerConfigAction(alertmanagerName));
    }
  }, [alertmanagerName]);

  const amConfigs = useUnifiedAlertingSelector((ua) => ua.amConfigs);
  const amConfig = alertmanagerName ? amConfigs[alertmanagerName]?.result : undefined;

  const amRoutes = amConfig?.alertmanager_config.route?.routes ?? [];

  const receivers = new Map(amConfig?.alertmanager_config.receivers?.map((receiver) => [receiver.name, receiver]));

  return (
    <Stack gap={2} direction="column">
      <AlertManagerPicker
        onChange={setAlertmanagerName}
        current={alertmanagerName}
        dataSources={alertManagers}
        className={styles.amPicker}
      />
      {amConfigState.loading && <LoadingPlaceholder text="Loading Alertmanager configuration" />}

      <h5>Alert Labels</h5>
      <TagList tags={Object.entries(alertLabels).map((label) => labelToString(label))} />

      <h5>Matching Notification policies</h5>
      <Stack direction="column" gap={2}>
        {amRoutes.map((route, index) => {
          // TODO This requires consideration of previous routes and the continue flag
          const isMatchingRoute = labelsMatchMatchers(
            alertLabels,
            route.object_matchers?.map(objectMatcherToMatcher) ?? []
          );
          return (
            <RouteLabelsMatch
              key={index}
              className={cx(styles.route, { [styles.matchingRoute]: isMatchingRoute })}
              isMatchingRoute={isMatchingRoute}
              labels={alertLabels}
              route={route}
              routeIndex={index + 1}
              receivers={receivers}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}

interface RouteLabelsMatchProps {
  isMatchingRoute: boolean;
  labels: Labels;
  route: Route;
  routeIndex?: number;
  receivers?: Map<string, Receiver>;
  className?: string;
}

function RouteLabelsMatch({ isMatchingRoute, labels, route, receivers = new Map(), className }: RouteLabelsMatchProps) {
  const styles = useStyles2(getRouteLabelsMatchStyles);
  const matchers = route.object_matchers?.map(objectMatcherToMatcher) ?? [];
  const receiver = route.receiver ? receivers.get(route.receiver) : undefined;

  return (
    <div className={className}>
      <Stack justifyContent="space-between">
        {receiver ? (
          <div>
            {receiver.name} ({receiver.grafana_managed_receiver_configs?.map((gmc) => gmc.type).join(', ')})
          </div>
        ) : (
          <div>
            <Icon name="exclamation-triangle" /> Contact point not defined
          </div>
        )}
      </Stack>
      <Stack gap={2}>
        {matchers.map((matcher, index) => {
          const matchingLabels = getLabelsMatchingMatcher(labels, matcher);
          const hasMatchingLabels = matchingLabels.length > 0;

          const matchingLabelsTooltip = (
            <>
              <h6>Matching labels: </h6>
              <Stack gap={2}>
                {matchingLabels.map((label, index) => (
                  <Tag key={index} name={labelToString(label)} colorIndex={1} />
                ))}
              </Stack>
            </>
          );

          return hasMatchingLabels ? (
            <Tooltip content={matchingLabelsTooltip}>
              <Tag key={index} name={matcherToString(matcher)} colorIndex={isMatchingRoute ? 23 : 6} />
            </Tooltip>
          ) : (
            <Tag key={index} name={matcherToString(matcher)} colorIndex={9} />
          );
        })}
      </Stack>
      <div>
        {route.routes?.map((nestedRoute, index) => {
          const isMatchingNestedRoute =
            labelsMatchMatchers(labels, nestedRoute.object_matchers?.map(objectMatcherToMatcher) ?? []) &&
            isMatchingRoute;

          return (
            <RouteLabelsMatch
              key={index}
              className={styles.nestedRoutes}
              isMatchingRoute={isMatchingNestedRoute}
              labels={labels}
              route={nestedRoute}
              routeIndex={index + 1}
              receivers={receivers}
            />
          );
        })}
      </div>
    </div>
  );
}

function getRouteLabelsMatchStyles(theme: GrafanaTheme2) {
  return {
    amPicker: css`
      margin-bottom: ${theme.spacing(0)};
    `,
    route: css`
      padding: ${theme.spacing(1)};
      border: 2px solid ${theme.colors.secondary.border};
      border-radius: ${theme.shape.borderRadius(2)};
      background-color: ${theme.colors.background.secondary};
    `,
    matchingRoute: css`
      border: 2px solid ${theme.colors.primary.border};
    `,
    nestedRoutes: css`
      position: relative;
      padding-left: ${theme.spacing(4)};
      border-left: 2px solid ${theme.colors.border.strong};

      ::before {
        content: '';
        display: inline-block;
        width: 20px;
        height: 20px;
        border-bottom: 2px solid ${theme.colors.border.strong};
        position: absolute;
        top: 0;
        left: 0;
      }

      :last-child {
        border-left: none;
      }

      :last-child:before {
        border-left: 2px solid ${theme.colors.border.strong};
      }
    `,
  };
}

function matcherToString(matcher: Matcher): string {
  const { name, operator, value } = matcherToMatcherField(matcher);
  return `${name}${operator}${value}`;
}

function labelToString(label: [key: string, value: string]) {
  return `${label[0]}=${label[1]}`;
}
