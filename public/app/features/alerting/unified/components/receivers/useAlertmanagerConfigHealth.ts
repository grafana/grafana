import { countBy } from 'lodash';

import { AlertmanagerConfig } from '../../../../../plugins/datasource/alertmanager/types';
import { getUsedContactPoints } from '../contact-points/utils';

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
