import { t } from '@grafana/i18n';
import { Badge } from '@grafana/ui';

import { type RepoType } from '../Wizard/types';
import { type RepoWorkflows } from '../types';
import { getIsReadOnlyWorkflows } from '../utils/repository';

import { ReadOnlyBadge } from './ReadOnlyBadge';

interface WorkflowBadgesProps {
  workflows?: RepoWorkflows;
  repoType?: RepoType;
}

/** Shows how people can save changes to a repository: read-only, direct push, pull request. */
export function WorkflowBadges({ workflows, repoType }: WorkflowBadgesProps) {
  if (getIsReadOnlyWorkflows(workflows)) {
    return <ReadOnlyBadge repoType={repoType} />;
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
