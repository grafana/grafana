import { t } from '@grafana/i18n';
import { type Condition } from 'app/api/clients/provisioning/v0alpha1';

/**
 * Returns the repository's PathConflict condition when it reports another repository
 * sharing its URL/branch/path. This is informational only - the resource-level
 * manager-identity check is what actually prevents two repositories from overwriting
 * each other's synced resources, so a conflict here does not block sync.
 */
export function getPathConflictCondition(conditions: Condition[] | undefined): Condition | undefined {
  const condition = conditions?.find((c) => c.type === 'PathConflict');
  return condition?.reason === 'PathConflict' ? condition : undefined;
}

/**
 * Shared title for the path-conflict warning, used by both the repository overview
 * banner and the onboarding wizard so the messaging isn't duplicated with different wording.
 */
export function getPathConflictWarningTitle(): string {
  return t(
    'provisioning.path-conflict-banner.title',
    'This repository shares a url, branch, and path combination with another repository. There will be sync errors because resources can only be managed by 1 repository.'
  );
}
