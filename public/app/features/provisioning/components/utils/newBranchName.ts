import { generateTimestamp } from './timestamp';

/**
 * Generate a new branch name for provisioned resources.
 * Uses the resource type as a prefix and appends a timestamp.
 */
export function generateNewBranchName(resourceType: string): string {
  return `${resourceType}/${generateTimestamp()}`;
}
