import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';
import { ReadOnlyBadge } from 'app/core/components/ReadOnlyBadge/ReadOnlyBadge';

import { type RepoWorkflows } from '../types';
import { getIsReadOnlyWorkflows } from '../utils/repository';
import { getReadOnlyRepositoryTooltip } from '../utils/tooltip';

interface WorkflowBadgesProps {
  workflows?: RepoWorkflows;
}

/** Shows how people can save changes to a repository: read-only, direct push, pull request. */
export function WorkflowBadges({ workflows }: WorkflowBadgesProps) {
  if (getIsReadOnlyWorkflows(workflows)) {
    return <ReadOnlyBadge tooltip={getReadOnlyRepositoryTooltip()} />;
  }

  return (
    <>
      {workflows?.includes('write') && (
        <Badge color="blue" icon="pen" text={t('provisioning.workflow-badges.direct-push', 'Direct push')} />
      )}
      {workflows?.includes('branch') && (
        <Badge color="blue" icon="code-branch" text={t('provisioning.workflow-badges.pull-request', 'Pull request')} />
      )}
    </>
  );
}
