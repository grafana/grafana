import { config } from '@grafana/runtime';

/**
 * Checks if the current Grafana instance is running on-prem
 * Uses namespace to determine deployment type:
 * - Cloud instances use namespace format: `stacks-{stackId}`
 * - On-prem instances use org-based namespace format: `org-{orgId}` or similar
 *
 * @returns true if the instance is on-premise, false if it's cloud
 */
export function isOnPrem() {
  const namespace = config.namespace;

  return !namespace.startsWith('stacks-');
}
