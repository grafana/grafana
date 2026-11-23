import { Badge } from '@grafana/ui';
import { ReadOnlyBadge } from 'app/core/components/ReadOnlyBadge/ReadOnlyBadge';

import { type RepoType } from '../Wizard/types';
import { type RepoWorkflows } from '../types';
import { getIsReadOnlyWorkflows } from '../utils/repository';
import { getReadOnlyRepositoryTooltip } from '../utils/tooltip';
import { getWorkflowDescription, getWorkflowLabel } from '../utils/workflow';

interface WorkflowBadgesProps {
  workflows?: RepoWorkflows;
  type?: RepoType;
  /** Named in the hover text, so people see which branch a workflow writes to. */
  branch?: string;
}

/** Shows how people can save changes to a repository: read-only, direct push, pull request. */
export function WorkflowBadges({ workflows, type, branch }: WorkflowBadgesProps) {
  if (getIsReadOnlyWorkflows(workflows)) {
    return <ReadOnlyBadge tooltip={getReadOnlyRepositoryTooltip()} />;
  }

  return (
    <>
      {workflows?.includes('write') && (
        <Badge
          color="blue"
          icon="pen"
          text={getWorkflowLabel('write', type)}
          tooltip={getWorkflowDescription('write', branch)}
        />
      )}
      {workflows?.includes('branch') && (
        <Badge
          color="blue"
          icon="code-branch"
          text={getWorkflowLabel('branch', type)}
          tooltip={getWorkflowDescription('branch', branch)}
        />
      )}
    </>
  );
}
