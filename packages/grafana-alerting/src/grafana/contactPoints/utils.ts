import { countBy, isEmpty } from 'lodash';

import { ContactPoint } from './types';

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
