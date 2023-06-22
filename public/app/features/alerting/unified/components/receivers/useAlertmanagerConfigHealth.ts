import { AlertmanagerConfig, Route } from '../../../../../plugins/datasource/alertmanager/types';

export type ContactPointConfigHealth = 'OK' | 'Unused';

export interface AlertmanagerConfigHealth {
  contactPoints: Record<string, ContactPointConfigHealth>;
}

export function useAlertmanagerConfigHealth(config: AlertmanagerConfig): AlertmanagerConfigHealth {
  if (!config.receivers) {
    return { contactPoints: {} };
  }

  if (!config.route) {
    return { contactPoints: Object.fromEntries(config.receivers.map((r) => [r.name, 'Unused'])) };
  }

  const definedContactPointNames = config.receivers?.map((receiver) => receiver.name) ?? [];
  const usedContactPoints = getUsedContactPoints(config.route);

  const contactPointsHealth: AlertmanagerConfigHealth['contactPoints'] = {};
  const configHealth: AlertmanagerConfigHealth = { contactPoints: contactPointsHealth };

  definedContactPointNames.forEach((contactPointName) => {
    contactPointsHealth[contactPointName] = usedContactPoints.includes(contactPointName) ? 'OK' : 'Unused';
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
