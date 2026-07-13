import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { LinkButton } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { PROVISIONING_URL } from '../constants';

interface ViewRepositoryButtonProps {
  /** Name of the managing repository (the `:name` segment of the repository view URL). */
  repositoryName?: string;
  /** Repository-managed resource whose backing repository no longer exists. */
  isOrphaned?: boolean;
}

/**
 * Compact icon link to the repository view (`/admin/provisioning/:name`). Self-gates: renders
 * nothing unless the resource has a repository name, is not orphaned, and the user has
 * `provisioning.repositories:read`. It also requires the `provisioning` feature toggle, since the
 * target repository route only exists when provisioning is enabled. Rendered as a real anchor so
 * middle-click / open-in-new-tab work.
 */
export function ViewRepositoryButton({ repositoryName, isOrphaned = false }: ViewRepositoryButtonProps) {
  if (
    !config.featureToggles.provisioning ||
    !repositoryName ||
    isOrphaned ||
    !contextSrv.hasPermission(AccessControlAction.ProvisioningRepositoriesRead)
  ) {
    return null;
  }

  const label = t('provisioning.view-repository-button.label', 'View repository');

  return (
    <LinkButton
      href={`${PROVISIONING_URL}/${encodeURIComponent(repositoryName)}`}
      variant="secondary"
      fill="outline"
      size="sm"
      icon="code-branch"
      tooltip={label}
      aria-label={label}
    />
  );
}
