import { css, cx } from '@emotion/css';
import { compact } from 'lodash';
import pluralize from 'pluralize';
import React, { useEffect, useMemo, useState } from 'react';
import { useAsync, useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Alert, Button, Collapse, Icon, IconButton, LoadingPlaceholder, Modal, TagList, useStyles2 } from '@grafana/ui';
import {
  AlertmanagerChoice,
  AlertManagerCortexConfig,
  Receiver,
  Route,
  RouteWithID,
} from 'app/plugins/datasource/alertmanager/types';

import { Stack } from '../../../../../../plugins/datasource/parca/QueryEditor/Stack';
import { AlertQuery, Labels } from '../../../../../../types/unified-alerting-dto';
import { alertRuleApi } from '../../../api/alertRuleApi';
import { fetchAlertManagerConfig } from '../../../api/alertmanager';
import { alertmanagerApi } from '../../../api/alertmanagerApi';
import { useExternalDataSourceAlertmanagers } from '../../../hooks/useExternalAmSelector';
import { useRouteGroupsMatcher } from '../../../useRouteGroupsMatcher';
import { addUniqueIdentifierToRoute } from '../../../utils/amroutes';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { labelsToTags } from '../../../utils/labels';
import { normalizeMatchers } from '../../../utils/matchers';
import { makeAMLink } from '../../../utils/misc';
import { RouteInstanceMatch } from '../../../utils/notification-policies';
import { MetaText } from '../../MetaText';
import { Spacer } from '../../Spacer';
import { Matchers } from '../../notification-policies/Matchers';

export const useGetPotentialInstancesByAlertManager = (
  alertManagerSourceName: string,
  potentialInstances: Labels[]
) => {
  // get the AM configuration to get the routes
  const {
    value: AMConfig,
    loading: configLoading,
    error: configError,
  } = useAsync(async () => {
    const AMConfig: AlertManagerCortexConfig = await fetchAlertManagerConfig(alertManagerSourceName);
    return AMConfig;
  }, []);

  const { matchInstancesToRoute } = useRouteGroupsMatcher();

  // to create the list of matching contact points we need to first get the rootRoute
  const { rootRoute, receivers } = useMemo(() => {
    if (!AMConfig) {
      return {};
    }
    // we also get receivers from the AMConfig
    const receivers = AMConfig.alertmanager_config.receivers;
    const rootRoute = AMConfig.alertmanager_config.route;
    rootRoute && normalizeTree(rootRoute);
    return {
      rootRoute: rootRoute ? addUniqueIdentifierToRoute(rootRoute) : undefined,
      receivers,
    };
  }, [AMConfig]);

  // create maps for routes to be get by id, this map also contains the path to the route
  const routesByIdMap: Map<string, RouteWithPath> = rootRoute ? getRoutesByIdMap(rootRoute) : new Map();
  // create map for receivers to be get by name
  const receiversByName =
    receivers?.reduce((map, receiver) => {
      return map.set(receiver.name, receiver);
    }, new Map<string, Receiver>()) ?? new Map<string, Receiver>();

  // match labels in the tree => map of notification policies and the alert instances (list of labels) in each one
  const {
    value: matchingMap = new Map<string, RouteInstanceMatch[]>(),
    loading: matchingLoading,
    error: matchingError,
  } = useAsync(async () => {
    if (!rootRoute) {
      return;
    }
    return await matchInstancesToRoute(rootRoute, potentialInstances);
  }, [rootRoute, potentialInstances]);

  return {
    routesByIdMap,
    receiversByName,
    matchingMap: matchingMap,
    loading: configLoading || matchingLoading,
    error: configError ?? matchingError,
  };
};

interface AlertManagerNameWithImage {
  name: string;
  img: string;
}

export const useGetAlertManagersSourceNamesAndImage = () => {
  //get current alerting config
  const { currentData: amConfigStatus } = alertmanagerApi.useGetAlertmanagerChoiceStatusQuery(undefined);

  const externalDsAlertManagers: AlertManagerNameWithImage[] = useExternalDataSourceAlertmanagers().map((ds) => ({
    name: ds.dataSource.name,
    img: ds.dataSource.meta.info.logos.small,
  }));
  const alertmanagerChoice = amConfigStatus?.alertmanagersChoice;
  const alertManagerSourceNamesWithImage: AlertManagerNameWithImage[] =
    alertmanagerChoice === AlertmanagerChoice.Internal
      ? [{ name: GRAFANA_RULES_SOURCE_NAME, img: 'public/img/grafana_icon.svg' }]
      : alertmanagerChoice === AlertmanagerChoice.External
      ? externalDsAlertManagers
      : [{ name: GRAFANA_RULES_SOURCE_NAME, img: 'public/img/grafana_icon.svg' }, ...externalDsAlertManagers];

  return alertManagerSourceNamesWithImage;
};

interface NotificationPreviewProps {
  customLabels: Array<{
    key: string;
    value: string;
  }>;
  alertQueries: AlertQuery[];
  condition: string;
}

export const NOTIFICATION_PREVIEW_TITLE = 'Alert instance routing preview';

export const NotificationPreview = ({ alertQueries, customLabels, condition }: NotificationPreviewProps) => {
  const styles = useStyles2(getStyles);
  // potential instances are the instances that are going to be routed to the notification policies
  const [potentialInstances, setPotentialInstances] = useState<Labels[]>([]);

  const { usePreviewMutation } = alertRuleApi;

  const [trigger, { data, isLoading }] = usePreviewMutation();

  useEffect(() => {
    // any time data is updated from trigger, we need to update the potential instances
    // convert data to list of labels: are the representation of the potential instances
    if (!isLoading) {
      const fields = data?.schema?.fields ?? [];
      const potentialInstances = compact(fields.map((field) => field.labels));
      setPotentialInstances(potentialInstances);
    }
  }, [data, isLoading]);

  const onPreview = () => {
    // Get the potential labels given the alert queries, the condition and the custom labels (autogenerated labels are calculated on the BE side)
    trigger({ alertQueries: alertQueries, condition: condition, customLabels: customLabels });
  };

  // Get alert managers source names
  const alertManagerSourceNamesAndImage = useGetAlertManagersSourceNamesAndImage();

  const onlyOneAM = alertManagerSourceNamesAndImage.length === 1;
  const renderHowToPreview = !data?.schema && !isLoading;

  return (
    <Stack direction="column" gap={2}>
      <div className={styles.routePreviewHeaderRow}>
        <h4 className={styles.marginBottom(0)}>{NOTIFICATION_PREVIEW_TITLE}</h4>
        <div className={styles.button}>
          <Button icon="sync" variant="secondary" type="button" onClick={onPreview}>
            Preview routing
          </Button>
        </div>
      </div>
      <div className={styles.textMuted}>
        Based on the labels you have added above and the labels that have been automatically assigned, alert instances
        are being route to notification policies in the way listed bellow. Expand the notification policies to see the
        instances which are going to be routed to them.
      </div>
      {isLoading && <div className={styles.textMuted}>Loading...</div>}
      {renderHowToPreview && (
        <div className={styles.previewHowToText}>
          {`When your query and labels are configured, click "Preview routing" to see the results here.`}
        </div>
      )}
      {!isLoading &&
        alertManagerSourceNamesAndImage.map((alertManagerSource) => {
          return (
            <NotificationPreviewByAlertManager
              alertManagerSource={alertManagerSource}
              potentialInstances={potentialInstances}
              onlyOneAM={onlyOneAM}
              key={alertManagerSource.name}
            />
          );
        })}
    </Stack>
  );
};

export function NotificationPreviewByAlertManager({
  alertManagerSource,
  potentialInstances,
  onlyOneAM,
}: {
  alertManagerSource: AlertManagerNameWithImage;
  potentialInstances: Labels[];
  onlyOneAM: boolean;
}) {
  const styles = useStyles2(getStyles);

  const { routesByIdMap, receiversByName, matchingMap, loading, error } = useGetPotentialInstancesByAlertManager(
    alertManagerSource.name,
    potentialInstances
  );

  if (error) {
    return (
      <Alert title="Cannot load Alertmanager configuration" severity="error">
        {error.message}
      </Alert>
    );
  }

  if (loading) {
    return <LoadingPlaceholder text="Loading routing preview..." />;
  }

  const matchingPoliciesFound = matchingMap.size > 0;

  return matchingPoliciesFound ? (
    <div className={styles.alertManagerRow}>
      {!onlyOneAM && (
        <Stack direction="row" alignItems="center">
          <div className={styles.firstAlertManagerLine}></div>
          <div className={styles.alertManagerName}>
            {' '}
            Alert manager:
            <img src={alertManagerSource.img} alt="" className={styles.img} />
            {alertManagerSource.name}
          </div>
          <div className={styles.secondAlertManagerLine}></div>
        </Stack>
      )}
      <Stack gap={1} direction="column">
        {Array.from(matchingMap.entries()).map(([routeId, instances]) => {
          const route = routesByIdMap.get(routeId);
          const receiver = route?.receiver && receiversByName.get(route.receiver);
          if (!route || !receiver) {
            return null;
          }
          return (
            <NotificationRoute
              // TODO Use the whole instance object to display matching labels
              instances={instances.map((i) => i.labels)}
              route={route}
              receiver={receiver}
              key={routeId}
              routesByIdMap={routesByIdMap}
              alertManagerSourceName={alertManagerSource.name}
            />
          );
        })}
      </Stack>
    </div>
  ) : null;
}

function thereAreNoMatchers(route: RouteWithID) {
  return route.object_matchers?.length === 0;
}

function PolicyPath({ route, routesByIdMap }: { routesByIdMap: Map<string, RouteWithPath>; route: RouteWithPath }) {
  const styles = useStyles2(getStyles);
  const routePathIds = route.path?.slice(1) ?? [];
  const routePathObjects = [...compact(routePathIds.map((id) => routesByIdMap.get(id))), route];

  return (
    <div className={styles.policyPathWrapper}>
      <div className={styles.defaultPolicy}>Default policy</div>
      {routePathObjects.map((pathRoute, index) => {
        return (
          <div key={pathRoute.id}>
            <div className={styles.policyInPath(index, index === routePathObjects.length - 1)}>
              {thereAreNoMatchers(pathRoute) ? (
                <div className={styles.textMuted}>No matchers</div>
              ) : (
                <Matchers matchers={pathRoute.object_matchers ?? []} />
              )}
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
  alertManagerSourceName,
}: {
  onClose: () => void;
  route: RouteWithPath;
  receiver: Receiver;
  routesByIdMap: Map<string, RouteWithPath>;
  alertManagerSourceName: string;
}) {
  const styles = useStyles2(getStyles);
  const isDefault = isDefaultPolicy(route);

  return (
    <Modal
      className={styles.detailsModal}
      isOpen={true}
      title="Alert routing details"
      onDismiss={onClose}
      onClickBackdrop={onClose}
    >
      <Stack gap={0} direction="column">
        <div className={cx(styles.textMuted, styles.marginBottom(2))}>
          Preview how this alert will be routed while firing.
        </div>
        <div className={cx(styles.marginBottom(2))}>Policy routing</div>
        {!isDefault ? (
          <>
            <div className={cx(styles.textMuted, styles.marginBottom(1))}>Matching labels</div>
            <NotificationPolicyMatchers route={route} />
          </>
        ) : (
          <div className={styles.textMuted}>Default policy</div>
        )}
        <div className={styles.separator(4)} />
        {!isDefault && (
          <>
            <div className={cx(styles.textMuted, styles.marginBottom(1))}>Notification policy path</div>
            <PolicyPath route={route} routesByIdMap={routesByIdMap} />
          </>
        )}
        <div className={styles.separator(4)} />
        <div className={styles.contactPoint}>
          <Stack gap={1} direction="row" alignItems="center">
            Contact point:
            <span className={styles.textMuted}>{receiver.name}</span>
          </Stack>
          <Stack gap={1} direction="row" alignItems="center">
            <a
              href={makeAMLink(
                `/alerting/notifications/receivers/${encodeURIComponent(receiver.name)}/edit`,
                alertManagerSourceName
              )}
              className={styles.link}
              target="_blank"
              rel="noreferrer"
            >
              See details <Icon name="external-link-alt" />
            </a>
          </Stack>
        </div>
        <div className={styles.button}>
          <Button variant="primary" type="button" onClick={onClose}>
            Close
          </Button>
        </div>
      </Stack>
    </Modal>
  );
}

function isDefaultPolicy(route: RouteWithPath) {
  return route.path?.length === 0;
}

function NotificationPolicyMatchers({ route }: { route: RouteWithPath }) {
  const styles = useStyles2(getStyles);
  if (isDefaultPolicy(route)) {
    return <div className={styles.defaultPolicy}>Default policy</div>;
  } else if (thereAreNoMatchers(route)) {
    return <div className={styles.textMuted}>No matchers</div>;
  } else {
    return <Matchers matchers={route.object_matchers ?? []} />;
  }
}

function NotificationRouteHeader({
  route,
  receiver,
  routesByIdMap,
  instancesCount,
  alertManagerSourceName,
  expandRoute,
}: {
  route: RouteWithPath;
  receiver: Receiver;
  routesByIdMap: Map<string, RouteWithPath>;
  instancesCount: number;
  alertManagerSourceName: string;
  expandRoute: boolean;
}) {
  const styles = useStyles2(getStyles);
  const [showDetails, setShowDetails] = useState(false);

  const onClickDetails = () => {
    setShowDetails(true);
  };

  return (
    <div className={styles.routeHeader}>
      <Stack gap={1} direction="row" alignItems="center">
        <IconButton
          aria-label={`${expandRoute ? 'Collapse' : 'Expand'} row`}
          size="md"
          data-testid="collapse-toggle"
          name={expandRoute ? 'angle-down' : 'angle-right'}
          type="button"
        />
        Notification policy
        <NotificationPolicyMatchers route={route} />
      </Stack>
      <Spacer />
      <Stack gap={2} direction="row" alignItems="center">
        <MetaText icon="layers-alt" data-testid="matching-instances">
          {instancesCount ?? '-'}
          <span>{pluralize('instance', instancesCount)}</span>
        </MetaText>
        <Stack gap={1} direction="row" alignItems="center">
          <div>
            <span className={styles.textMuted}>@ Delivered to</span> {receiver.name}
          </div>

          <div className={styles.verticalBar} />

          <Button type="button" onClick={onClickDetails} variant="secondary" fill="outline" size="sm">
            See details
          </Button>
        </Stack>
      </Stack>
      {showDetails && (
        <NotificationRouteDetailsModal
          onClose={() => setShowDetails(false)}
          route={route}
          receiver={receiver}
          routesByIdMap={routesByIdMap}
          alertManagerSourceName={alertManagerSourceName}
        />
      )}
    </div>
  );
}

interface NotificationRouteProps {
  route: RouteWithPath;
  receiver: Receiver;
  instances: Labels[];
  routesByIdMap: Map<string, RouteWithPath>;
  alertManagerSourceName: string;
}

function NotificationRoute({
  route,
  instances,
  receiver,
  routesByIdMap,
  alertManagerSourceName,
}: NotificationRouteProps) {
  const styles = useStyles2(getStyles);
  const [expandRoute, setExpandRoute] = useToggle(false);

  return (
    <Collapse
      label={
        <NotificationRouteHeader
          route={route}
          receiver={receiver}
          routesByIdMap={routesByIdMap}
          instancesCount={instances.length}
          alertManagerSourceName={alertManagerSourceName}
          expandRoute={expandRoute}
        />
      }
      className={styles.collapsableSection}
      onToggle={setExpandRoute}
      collapsible={false}
      isOpen={expandRoute}
      labelClassName={styles.collapseLabel}
    >
      <Stack gap={1} direction="column">
        <div className={styles.routeInstances}>
          {instances.map((instance) => {
            const tags = labelsToTags(instance);
            return (
              <div className={styles.tagListCard} key={JSON.stringify(instance)}>
                {tags.length > 0 ? (
                  <TagList tags={tags} className={styles.labelList} />
                ) : (
                  <div className={styles.textMuted}>No labels</div>
                )}
              </div>
            );
          })}
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
  return map;
}

// normalize all the nodes in the tree
function normalizeTree(routeTree: Route) {
  const routeMatchers = normalizeMatchers(routeTree);
  routeTree.object_matchers = routeMatchers;
  routeTree.matchers = undefined;
  routeTree.routes?.forEach((route) => normalizeTree(route));
}

const getStyles = (theme: GrafanaTheme2) => ({
  collapsableSection: css`
    width: auto;
    border: 0;
  `,
  textMuted: css`
    color: ${theme.colors.text.secondary};
  `,
  previewHowToText: css`
    display: flex;
    color: ${theme.colors.text.secondary};
    justify-content: center;
    font-size: ${theme.typography.size.sm};
  `,
  routePreviewHeaderRow: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  `,
  routeHeader: css`
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
    width: 100%;
    align-items: center;
    border-bottom: solid 1px ${theme.colors.border.weak};
    padding: ${theme.spacing(1)};
    background: ${theme.colors.background.secondary};
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
    margin-left: ${theme.spacing(7)};
    position: relative;

    &:before {
      content: '';
      position: absolute;
      height: calc(100% - 10px);
      width: ${theme.spacing(4)};
      border-left: solid 1px ${theme.colors.border.weak};
      border-bottom: solid 1px ${theme.colors.border.weak};
      margin-top: ${theme.spacing(-2)};
      margin-left: -17px;
    }
  `,

  detailsModal: css`
    max-width: 560px;
  `,
  button: css`
    justify-content: flex-end;
    display: flex;
  `,
  separator: (units: number) => css`
    margin-top: ${theme.spacing(units)};
  `,
  verticalBar: css`
    width: 1px;
    height: 20px;
    background-color: ${theme.colors.secondary.main};
    margin-left: ${theme.spacing(1)};
    margin-right: ${theme.spacing(1)};
  `,
  alertManagerRow: css`
    margin-top: ${theme.spacing(2)};
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
    width: 100%;
  `,
  alertManagerName: css`
    width: fit-content;
  `,
  firstAlertManagerLine: css`
    height: 1px;
    width: ${theme.spacing(4)};
    background-color: ${theme.colors.secondary.main};
  `,
  secondAlertManagerLine: css`
    height: 1px;
    width: 100%;
    flex: 1;
    background-color: ${theme.colors.secondary.main};
  `,
  tagsInDetails: css`
    display: flex;
    justify-content: flex-start;
    flex-wrap: wrap;
  `,
  policyPathWrapper: css`
    display: flex;
    flex-direction: column;
    margin-top: ${theme.spacing(1)};
  `,
  policyPathItemMatchers: css`
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
  `,
  defaultPolicy: css`
    padding: ${theme.spacing(0.5)};
    background: ${theme.colors.background.secondary};
    width: fit-content;
  `,
  policyInPath: (index = 0, higlight = false) => css`
    margin-left: ${30 + index * 30}px;
    padding: ${theme.spacing(1)};
    margin-top: ${theme.spacing(1)};
    border: solid 1px ${theme.colors.border.weak};
    background: ${theme.colors.background.secondary};
    width: fit-content;
    position: relative;

    ${
      higlight &&
      css`
        border: solid 1px ${theme.colors.info.border};
      `
    },
    &:before {
      content: '';
      position: absolute;
      height: calc(100% - 10px);
      width: ${theme.spacing(1)};
      border-left: solid 1px ${theme.colors.border.weak};
      border-bottom: solid 1px ${theme.colors.border.weak};
      margin-top: ${theme.spacing(-2)};
      margin-left: -17px;
    }
  }
  `,
  contactPoint: css`
    display: flex;
    flex-direction: row;
    gap: ${theme.spacing(1)};
    align-items: center;
    justify-content: space-between;
    margin-bottom: ${theme.spacing(1)};
  `,
  link: css`
    display: block;
    color: ${theme.colors.text.link};
  `,
  img: css`
    margin-left: ${theme.spacing(2)};
    width: ${theme.spacing(3)};
    height: ${theme.spacing(3)};
    margin-right: ${theme.spacing(1)};
  `,
  marginBottom: (units: number) => css`
    margin-bottom: ${theme.spacing(theme.spacing(units))};
  `,
});
