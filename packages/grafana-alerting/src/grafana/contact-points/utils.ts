import { ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisResourceReceiverV0Alpha1Receiver } from '../api.gen';

// type aliases – we should centralise th
type ContactPoint = ComGithubGrafanaGrafanaAppsAlertingNotificationsPkgApisResourceReceiverV0Alpha1Receiver;

export function getContactPointDescription(contactPoint: ContactPoint) {
  const integrationCounts = new Map<string, number>();

  // Count the occurrences of each integration type
  contactPoint.spec.integrations?.forEach((integration) => {
    const type = integration.type;
    integrationCounts.set(type, (integrationCounts.get(type) || 0) + 1);
  });

  // Format the description string
  const description = Array.from(integrationCounts.entries())
    .map(([type, count]) => (count > 1 ? `${type} (${count})` : type))
    .join(', ');

  return description;
}
