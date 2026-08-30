import { generateTimestamp } from './timestamp';

/**
 * Generate a new branch name for provisioned resources.
 * Uses the given prefix and appends a timestamp.
 */
export function generateNewBranchName(prefix: string): string {
  return `${prefix}/${generateTimestamp()}`;
}
