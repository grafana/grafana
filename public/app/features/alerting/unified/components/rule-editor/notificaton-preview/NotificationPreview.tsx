import { css } from '@emotion/css';
import { compact } from 'lodash';
import React, { useMemo } from 'react';
import { useAsync, useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Collapse, TagList, useStyles2 } from '@grafana/ui';
import { AlertManagerCortexConfig, Receiver, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { AlertQuery, Labels } from '../../../../../../types/unified-alerting-dto';
import { alertRuleApi } from '../../../api/alertRuleApi';
import { fetchAlertManagerConfig } from '../../../api/alertmanager';
import { addUniqueIdentifierToRoute } from '../../../utils/amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { labelsToTags } from '../../../utils/labels';
import { findMatchingRoutes } from '../../../utils/notification-policies';
import { Spacer } from '../../Spacer';
import { Matchers } from '../../notification-policies/Matchers';

interface NotificationPreviewProps {
  customLabels: Array<{
    key: string;
    value: string;
  }>;
  alertQueries: AlertQuery[];
  condition: string;
}

export function NotificationPreview({ alertQueries, customLabels, condition }: NotificationPreviewProps) {
  const styles = useStyles2(getStyles);

  // Get the potential labels
  // once we have them we need to 'merge' with customLabels

  const { useEvalQuery } = alertRuleApi;
  const { data } = useEvalQuery({ alertQueries: alertQueries });

  // convert data to list of labels]

  const conditionFrames = (data?.results && data.results[condition]?.frames) ?? [];
  const potentialInstances = compact(conditionFrames.map((frame) => frame.schema?.fields[0]?.labels));
  // todo: we asume merge with custom labels will be done at the BE side adding a param in the eval query

  // get the AM configuration
  const { value: AMConfig } = useAsync(async () => {
    const AMConfig: AlertManagerCortexConfig = await fetchAlertManagerConfig(GRAFANA_RULES_SOURCE_NAME);
    return AMConfig;
  }, []);

  // get the rootRoute and receivers from the AMConfig
  const { rootRoute, receivers } = useMemo(() => {
    if (!AMConfig) {
      return {};
    }

    const routes = AMConfig.alertmanager_config.route?.routes;
    const receivers = AMConfig.alertmanager_config.receivers;

    const rootRoute: Route | undefined = routes ? routes[0] : undefined;
    return {
      rootRoute: rootRoute ? addUniqueIdentifierToRoute(rootRoute) : undefined,
      receivers,
    };
  }, [AMConfig]);

  // create maps for routes to be get by id
  const routesByIdMap: Map<string, RouteWithID> = rootRoute ? getRoutesByIdMap(rootRoute) : new Map();
  // create map for receivers to be get by name
  const receiversByName =
    receivers?.reduce((map, receiver) => {
      return map.set(receiver.name, receiver);
    }, new Map<string, Receiver>()) ?? new Map<string, Receiver>();

  // match labels in the tree => list of notification policies and the alert instances in each one
  const matchingMap: Map<string, Labels[]> = rootRoute?.id
    ? matchInstancesToPolicyTree(rootRoute, potentialInstances)
    : new Map();

  return (
    <Stack gap={1} direction="column">
      <h3>Alert instance routing preview</h3>
      <div className={styles.textMuted}>
        Based on the labels you have added above and the labels that have been automatically assigned, alert instances
        are being route to notification policies in the way listed bellow
      </div>
      <Stack gap={1} direction="column">
        {Array.from(matchingMap.entries()).map(([routeId, instances]) => {
          const route = routesByIdMap.get(routeId);
          const receiver = route?.receiver && receiversByName.get(route.receiver);
          if (!route || !receiver) {
            return null;
          }
          return <NotificationRoute instances={instances} route={route} receiver={receiver} key={routeId} />;
        })}
      </Stack>
    </Stack>
  );
}

function NotificationRouteHeader({ route, receiver }: { route: RouteWithID; receiver: Receiver }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.routeHeader}>
      <span>Notification policy</span>
      <Matchers matchers={route.object_matchers ?? []} />
      <Spacer />
      <div>
        <span className={styles.textMuted}>@ Delivered to</span> {receiver.name}
      </div>
    </div>
  );
}
interface NotificationRouteProps {
  route: RouteWithID;
  receiver: Receiver;
  instances: Labels[];
}

function NotificationRoute({ route, instances, receiver }: NotificationRouteProps) {
  const styles = useStyles2(getStyles);
  const [expandRoute, setExpandRoute] = useToggle(false);

  return (
    <Collapse
      label={<NotificationRouteHeader route={route} receiver={receiver} />}
      className={styles.collapsableSection}
      onToggle={setExpandRoute}
      collapsible={true}
      isOpen={expandRoute}
      labelClassName={styles.collapseLabel}
    >
      <Stack gap={1} direction="column">
        {instances.map((instance) => (
          <TagList tags={labelsToTags(instance)} key={JSON.stringify(instance)} />
        ))}
      </Stack>
    </Collapse>
  );
}

// we traverse the whole tree and we create a map with <id , RouteWithID>
function getRoutesByIdMap(rootRoute: RouteWithID): Map<string, RouteWithID> {
  const map = new Map<string, RouteWithID>();

  function addRoutesToMap(route: RouteWithID) {
    map.set(route.id, route);
    route.routes?.forEach((r) => addRoutesToMap(r));
  }

  addRoutesToMap(rootRoute);

  return map;
}

function matchInstancesToPolicyTree(routeTree: RouteWithID, instancesToMatch: Labels[]): Map<string, Labels[]> {
  const result = new Map<string, Labels[]>();

  instancesToMatch.forEach((instance) => {
    const matchingRoutes = findMatchingRoutes(routeTree, Object.entries(instance));
    matchingRoutes.forEach((route) => {
      const currentRoute = result.get(route.id);
      if (currentRoute) {
        currentRoute.push(instance);
      } else {
        result.set(route.id, [instance]);
      }
    });
  });

  return result;
}

const getStyles = (theme: GrafanaTheme2) => ({
  collapsableSection: css`
    width: auto;
  `,
  textMuted: css`
    color: ${theme.colors.text.secondary};
  `,
  routeHeader: css`
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
    width: 100%;
  `,
  collapseLabel: css`
    flex: 1;
  `,
});
