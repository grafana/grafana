import { ReadOnlyBadge as BaseReadOnlyBadge } from 'app/core/components/ReadOnlyBadge/ReadOnlyBadge';

import { type RepoType } from '../Wizard/types';
import { getReadOnlyTooltipText } from '../utils/tooltip';

export function ReadOnlyBadge({ repoType }: { repoType?: RepoType }) {
  return (
    <BaseReadOnlyBadge
      tooltip={getReadOnlyTooltipText({ isLocal: repoType === 'local', isSource: repoType === 'source' })}
    />
  );
}
