import { countBy } from 'lodash';

import { AlertmanagerConfig, Route } from '../../../../../plugins/datasource/alertmanager/types';

export interface ContactPointConfigHealth {
  matchingRoutes: number;
}

export interface AlertmanagerConfigHealth {
  contactPoints: Record<string, ContactPointConfigHealth>;
}

export function useAlertmanagerConfigHealth(config: AlertmanagerConfig): AlertmanagerConfigHealth {
  if (!config.receivers) {
    return { contactPoints: {} };
  }

  if (!config.route) {
    return { contactPoints: Object.fromEntries(config.receivers.map((r) => [r.name, { matchingRoutes: 0 }])) };
  }

  const definedContactPointNames = config.receivers?.map((receiver) => receiver.name) ?? [];
  const usedContactPoints = getUsedContactPoints(config.route);
  const usedContactPointCounts = countBy(usedContactPoints);

  const contactPointsHealth: AlertmanagerConfigHealth['contactPoints'] = {};
  const configHealth: AlertmanagerConfigHealth = { contactPoints: contactPointsHealth };

  definedContactPointNames.forEach((contactPointName) => {
    contactPointsHealth[contactPointName] = { matchingRoutes: usedContactPointCounts[contactPointName] ?? 0 };
  });

  return configHealth;
}

function getUsedContactPoints(route: Route): string[] {
  const childrenContactPoints = route.routes?.flatMap((route) => getUsedContactPoints(route)) ?? [];
  if (route.receiver) {
    return [route.receiver, ...childrenContactPoints];
  }

  return childrenContactPoints;
}
