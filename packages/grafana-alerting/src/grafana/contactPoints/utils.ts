import { countBy, isEmpty } from 'lodash';

import { ContactPoint } from './types';

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
export function getContactPointDescription(contactPoint: ContactPoint): string {
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
