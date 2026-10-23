import { ReadOnlyBadge as BaseReadOnlyBadge } from 'app/core/components/ReadOnlyBadge/ReadOnlyBadge';

import { type RepoType } from '../Wizard/types';
import { getReadOnlyTooltipText } from '../utils/tooltip';

interface ReadOnlyBadgeProps {
  /** Type of the managing repository. Local (file) provisioning changes the tooltip copy. */
  repoType?: RepoType;
}

/**
 * Badge indicating that a managed resource is read-only and can only be changed through its
 * managing repository. Shown alongside `ManagedBadge` on folder and dashboard pages.
 */
export function ReadOnlyBadge({ repoType }: ReadOnlyBadgeProps) {
  return <BaseReadOnlyBadge tooltip={getReadOnlyTooltipText({ isLocal: repoType === 'local' })} />;
}
