import { countBy, isEmpty } from 'lodash';

import { type Receiver } from '../api/notifications';
import { type ContactPoint, type ContactPointMetadataAnnotations } from '../api/notifications/types';

// Annotation key that indicates whether a contact point can be used in routes and rules
const CAN_USE_ANNOTATION = 'grafana.com/canUse';

/**
 * Minimal structural type that any k8s alerting entity satisfies.
 * Accepts ContactPoint, Receiver, and the app-internal EntityToCheck type alike.
 */
type WithContactPointAnnotations = {
  metadata?: { annotations?: ContactPointMetadataAnnotations };
};

/**
 * Checks if a contact point can be used in routes and rules.
 * Contact points that are imported from external sources (e.g., Prometheus Alertmanager)
 * have the `grafana.com/canUse` annotation set to `false` and cannot be used.
 *
 * @param contactPoint - The ContactPoint object to check
 * @returns `true` if the contact point can be used, `false` otherwise
 */
export function isUsableContactPoint(contactPoint: ContactPoint | Receiver): boolean {
  const canUse = contactPoint.metadata?.annotations?.[CAN_USE_ANNOTATION];
  return canUse === 'true';
}

/**
 * Returns the number of notification policy routes that reference this contact point,
 * as reported by the server-set `grafana.com/inUse/routes` annotation.
 * Returns 0 when the annotation is absent.
 */
export function getContactPointInUseRoutes(contactPoint: WithContactPointAnnotations): number {
  const value = contactPoint.metadata?.annotations?.['grafana.com/inUse/routes'];
  return Number(value) || 0;
}

/**
 * Returns the number of alert rules that reference this contact point via simplified routing,
 * as reported by the server-set `grafana.com/inUse/rules` annotation.
 * Returns 0 when the annotation is absent.
 */
export function getContactPointInUseRules(contactPoint: WithContactPointAnnotations): number {
  const value = contactPoint.metadata?.annotations?.['grafana.com/inUse/rules'];
  return Number(value) || 0;
}

/**
 * Returns how many routes and rules currently reference this contact point,
 * as reported by the server-set in-use annotations.
 *
 * @returns `{ routes, rules }` — each count is 0 when the annotation is absent.
 */
export function getContactPointInUse(contactPoint: WithContactPointAnnotations): { routes: number; rules: number } {
  return {
    routes: getContactPointInUseRoutes(contactPoint),
    rules: getContactPointInUseRules(contactPoint),
  };
}

/**
 * Generates a human-readable description of a ContactPoint by summarizing its integrations.
 * If the ContactPoint has no integrations, it returns an empty placeholder text.
 *
 * For integrations, it counts the occurrences of each type and formats them as a comma-separated list.
 * Multiple integrations of the same type are indicated with a count in parentheses.
 *
 * @param contactPoint - The ContactPoint object to describe
 * @returns A string description of the ContactPoint's integrations
 */
export function getContactPointDescription(contactPoint: ContactPoint | Receiver): string {
  if (isEmpty(contactPoint.spec.integrations)) {
    return '<empty contact point>';
  }

  // Count the occurrences of each integration type
  const integrationCounts = countBy(contactPoint.spec.integrations, (integration) => integration.type);

  const description = Object.entries(integrationCounts)
    .map(([type, count]) => {
      // either "email" or "email (2)" but not "email (1)"
      return count > 1 ? `${type} (${count})` : type;
    })
    .join(', ');

  return description;
}
