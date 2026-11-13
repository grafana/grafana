import { t } from '@grafana/i18n';
import { ReadOnlyBadge as BaseReadOnlyBadge } from 'app/core/components/ReadOnlyBadge/ReadOnlyBadge';

import { type RepoType } from '../Wizard/types';
import { getManagedReadOnlyTooltip, getPullOnlyTooltipText, getReadOnlyTooltipText } from '../utils/tooltip';

/** What is read-only, which is all that differs between the variants. */
type ReadOnlySubject = 'resource' | 'repository' | 'configuration';

interface ReadOnlyBadgeProps {
  /** Type of the managing repository. Local (file) provisioning changes the tooltip copy. */
  repoType?: RepoType;
  subject?: ReadOnlySubject;
}

/**
 * Badge for something provisioning will not let the user change here: a resource that can only be
 * changed through its repository (`subject="resource"`, the default, used on folder and dashboard
 * pages), a repository Grafana only ever reads from (`subject="repository"`), or a
 * Repository/Connection whose own configuration comes from its manager (`subject="configuration"`).
 */
export function ReadOnlyBadge({ repoType, subject = 'resource' }: ReadOnlyBadgeProps) {
  const { text, tooltip } = getBadgeDisplay(subject, repoType === 'local');

  return <BaseReadOnlyBadge text={text} tooltip={tooltip} />;
}

function getBadgeDisplay(subject: ReadOnlySubject, isLocal: boolean): { text?: string; tooltip: string } {
  switch (subject) {
    case 'repository':
      return {
        // Said differently from the others: it is a property of the repository's own workflows,
        // not of anything the reader could change on the page they are on.
        text: t('provisioning.read-only-badge.pull-only', 'Pull only'),
        tooltip: getPullOnlyTooltipText({ isLocal }),
      };
    case 'configuration':
      return { tooltip: getManagedReadOnlyTooltip() };
    default:
      return { tooltip: getReadOnlyTooltipText({ isLocal }) };
  }
}
