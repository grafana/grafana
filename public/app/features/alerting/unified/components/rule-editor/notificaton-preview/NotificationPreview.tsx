import { css } from '@emotion/css';
import { compact } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useAsync, useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Button, Collapse, Modal, TagList, useStyles2 } from '@grafana/ui';
import { AlertManagerCortexConfig, Receiver, Route, RouteWithID } from 'app/plugins/datasource/alertmanager/types';

import { ObjectMatcher } from '../../../../../../plugins/datasource/alertmanager/types';
import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { AlertQuery, Labels } from '../../../../../../types/unified-alerting-dto';
import { alertRuleApi } from '../../../api/alertRuleApi';
import { fetchAlertManagerConfig } from '../../../api/alertmanager';
import { addUniqueIdentifierToRoute } from '../../../utils/amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { labelsToTags } from '../../../utils/labels';
import { normalizeMatchers } from '../../../utils/matchers';
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

export const useGetPotentialInstances = (alertQueries: AlertQuery[], condition: string) => {
  // todo: we asume merge with custom labels will be done at the BE side adding a param in the eval query
  // we asume the eval endpoint is going to receive an additional parameter the list of custom labels,
  // and the response will return this merged labels with the resulting instances

  const { useEvalQuery } = alertRuleApi;
  const { data } = useEvalQuery({ alertQueries: alertQueries });

  // convert data to list of labels: are the represetnation of the potential instances
  const conditionFrames = (data?.results && data.results[condition]?.frames) ?? [];
  const potentialInstances = compact(conditionFrames.map((frame) => frame.schema?.fields[0]?.labels));
  return potentialInstances;
};

export function NotificationPreview({ alertQueries, customLabels, condition }: NotificationPreviewProps) {
  const styles = useStyles2(getStyles);

  // Get the potential labels
  const potentialInstances = useGetPotentialInstances(alertQueries, condition);

  // get the AM configuration to get the routes
  const { value: AMConfig } = useAsync(async () => {
    const AMConfig: AlertManagerCortexConfig = await fetchAlertManagerConfig(GRAFANA_RULES_SOURCE_NAME);
    return AMConfig;
  }, []);

  // todo: get the alert manager list where alerts are going to be sent
  // to create the list of matching contact points
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
  const routesByIdMap: Map<string, RouteWithPath> = rootRoute ? getRoutesByIdMap(rootRoute) : new Map();
  // create map for receivers to be get by name
  const receiversByName =
    receivers?.reduce((map, receiver) => {
      return map.set(receiver.name, receiver);
    }, new Map<string, Receiver>()) ?? new Map<string, Receiver>();

  // match labels in the tree => list of notification policies and the alert instances in each one
  const matchingMap: Map<string, Labels[]> = rootRoute?.id
    ? matchInstancesToPolicyTree(rootRoute, potentialInstances)
    : new Map();

  const matchingPoliciesFound = matchingMap.size > 0;

  return (
    <Stack gap={1} direction="column">
      <h3>Alert instance routing preview</h3>
      {matchingPoliciesFound ? (
        <>
          <div className={styles.textMuted}>
            Based on the labels you have added above and the labels that have been automatically assigned, alert
            instances are being route to notification policies in the way listed bellow. Expand the notification
            policies to see the instances which are going to be routed to them.
          </div>
          <Stack gap={1} direction="column">
            {Array.from(matchingMap.entries()).map(([routeId, instances]) => {
              const route = routesByIdMap.get(routeId);
              const receiver = route?.receiver && receiversByName.get(route.receiver);
              if (!route || !receiver) {
                return null;
              }
              return (
                <NotificationRoute
                  instances={instances}
                  route={route}
                  receiver={receiver}
                  key={routeId}
                  routesByIdMap={routesByIdMap}
                />
              );
            })}
          </Stack>
        </>
      ) : (
        <div className={styles.textMuted}>
          Based on the labels you have added above and the labels that have been automatically assigned, there will be
          no alert instances being route to notification policies
        </div>
      )}
    </Stack>
  );
}

// function to convert ObjectMatchers to a array of strings
const objectMatchersToString = (matchers: ObjectMatcher[]): string[] => {
  return matchers.map((matcher) => {
    const [name, operator, value] = matcher;
    return `${name}${operator}${value}`;
  });
};

function PolicyPath({ route, routesByIdMap }: { routesByIdMap: Map<string, RouteWithPath>; route: RouteWithID }) {
  const styles = useStyles2(getStyles);
  const routePathIds = routesByIdMap.get(route.id)?.path ?? [];
  const routePathObjects = [...compact(routePathIds.map((id) => routesByIdMap.get(id))), route];

  return (
    <div className={styles.policyPath}>
      <div className={styles.defaultPolicy}>Default policy</div>
      {routePathObjects.map((route_, index) => {
        return (
          <div key={route_.id}>
            <div className={styles.policyInPath(index)}>
              <Matchers matchers={route_.object_matchers ?? []} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotificationRouteDetailsModal({
  onClose,
  route,
  receiver,
  routesByIdMap,
}: {
  onClose: () => void;
  route: RouteWithID;
  receiver: Receiver;
  routesByIdMap: Map<string, RouteWithPath>;
}) {
  const styles = useStyles2(getStyles);
  const matchers = normalizeMatchers(route);
  const stringMatchers = objectMatchersToString(matchers);

  return (
    <Modal
      className={styles.detailsModal}
      isOpen={true}
      title={<h3>Alert routing details</h3>}
      onDismiss={onClose}
      onClickBackdrop={onClose}
    >
      <Stack gap={1} direction="column">
        <div className={styles.textMuted}>Preview how this alert will be routed while firing.</div>
        <div>Policy Routing</div>
        <div className={styles.textMuted}>Matching labels for this policy</div>
        <TagList tags={stringMatchers} className={styles.tagsInDetails} />
        <div className={styles.separator} />
        <div className={styles.textMuted}>Notification policy path</div>
        <PolicyPath route={route} routesByIdMap={routesByIdMap} />
        Contact point:
        <span className={styles.textMuted}>{receiver.name}</span>
        <div className={styles.button}>
          <Button variant="primary" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}

function NotificationRouteHeader({
  route,
  receiver,
  routesByIdMap,
}: {
  route: RouteWithID;
  receiver: Receiver;
  routesByIdMap: Map<string, RouteWithPath>;
}) {
  const styles = useStyles2(getStyles);
  const [showDetails, setShowDetails] = useState(false);

  const onClickDetails = () => {
    setShowDetails(true);
  };

  return (
    <div className={styles.routeHeader}>
      <span>Notification policy</span>
      <Matchers matchers={route.object_matchers ?? []} />
      <Spacer />
      <div>
        <span className={styles.textMuted}>@ Delivered to</span> {receiver.name}
      </div>
      <Button type="button" onClick={onClickDetails} variant="secondary">
        See details
      </Button>
      {showDetails && (
        <NotificationRouteDetailsModal
          onClose={() => setShowDetails(false)}
          route={route}
          receiver={receiver}
          routesByIdMap={routesByIdMap}
        />
      )}
    </div>
  );
}
interface NotificationRouteProps {
  route: RouteWithID;
  receiver: Receiver;
  instances: Labels[];
  routesByIdMap: Map<string, RouteWithPath>;
}

function NotificationRoute({ route, instances, receiver, routesByIdMap }: NotificationRouteProps) {
  const styles = useStyles2(getStyles);
  const [expandRoute, setExpandRoute] = useToggle(false);

  return (
    <Collapse
      label={<NotificationRouteHeader route={route} receiver={receiver} routesByIdMap={routesByIdMap} />}
      className={styles.collapsableSection}
      onToggle={setExpandRoute}
      collapsible={true}
      isOpen={expandRoute}
      labelClassName={styles.collapseLabel}
    >
      <Stack gap={1} direction="column">
        <div className={styles.routeInstances}>
          {instances.map((instance) => (
            <div className={styles.tagListCard} key={JSON.stringify(instance)}>
              <TagList tags={labelsToTags(instance)} className={styles.labelList} />
            </div>
          ))}
        </div>
      </Stack>
    </Collapse>
  );
}

interface RouteWithPath extends RouteWithID {
  path: string[]; // path from root route to this route
}
// we traverse the whole tree and we create a map with <id , RouteWithPath>
function getRoutesByIdMap(rootRoute: RouteWithID): Map<string, RouteWithPath> {
  const map = new Map<string, RouteWithPath>();

  function addRoutesToMap(route: RouteWithID, path: string[] = []) {
    map.set(route.id, { ...route, path: path });
    route.routes?.forEach((r) => addRoutesToMap(r, [...path, route.id]));
  }
  addRoutesToMap(rootRoute, []);
  console.log('map', map);
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
  labelList: css`
    justify-content: flex-start;
  `,
  tagListCard: css`
    flex: 1;
    position: relative;
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(1)};
    margin: ${theme.spacing(1)};

    border-radius: ${theme.shape.borderRadius(2)};
    border: solid 1px ${theme.colors.border.weak};
  `,
  routeInstances: css`
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
  detailsModal: css`
    max-width: 560px;
  `,
  button: css`
    margin-top: ${theme.spacing(2)};
    justify-content: flex-end;
    display: flex;
  `,
  separator: css`
    width: 100%;
    height: 1px;
    background-color: ${theme.colors.secondary.main};
  `,
  tagsInDetails: css`
    display: flex;
    justify-content: flex-start;
    flex-wrap: wrap;
    margin-bottom: ${theme.spacing(2)};
  `,
  policyPath: css`
    display: flex;
    flex-direction: column;
    margin-top: ${theme.spacing(2)};
  `,
  policyPathItemMatchers: css`
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
  `,
  defaultPolicy: css`
    border: solid 1px ${theme.colors.border.weak};
    padding: ${theme.spacing(1)};
    width: fit-content;
  `,
  policyInPath: (index = 0) => css`
    margin-left: ${30 + index * 30}px;
    padding: ${theme.spacing(1)};
    margin-top: ${theme.spacing(1)};
    border: solid 1px ${theme.colors.border.weak};
    width: fit-content;
}
`,
});
