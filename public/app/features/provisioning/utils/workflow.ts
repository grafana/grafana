import { t } from '@grafana/i18n';
import { type GetRepositoryRefsApiResponse, type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type RepoType } from '../Wizard/types';
import { type WorkflowOption } from '../types';

/**
 * The backend's workflow for a target ref: an empty ref or the configured branch is a direct `write`;
 * any other branch, new or existing, is `branch`.
 */
export function getWorkflowForRef(repository: RepositoryView | undefined, ref: string | undefined): WorkflowOption {
  return !ref || ref === repository?.branch ? 'write' : 'branch';
}

/** The `ref` to send with a commit: omitted for a direct write so the backend targets the configured branch. */
export function getRequestRef(repository: RepositoryView | undefined, ref: string | undefined): string | undefined {
  return getWorkflowForRef(repository, ref) === 'write' ? undefined : ref;
}

/** Whether `ref` names a branch that already exists in the repository's listed refs. */
export function isKnownRef(refs: GetRepositoryRefsApiResponse | undefined, ref: string | undefined): boolean {
  return Boolean(ref) && Boolean(refs?.items?.some((item) => item.name === ref));
}

/** User-facing name of a save workflow; GitLab calls a proposed change a merge request. */
export function getWorkflowLabel(workflow: WorkflowOption, type?: RepoType): string {
  if (workflow === 'write') {
    return t('provisioning.workflow.direct-push', 'Direct push');
  }
  return type === 'gitlab'
    ? t('provisioning.workflow.merge-request', 'Merge request')
    : t('provisioning.workflow.pull-request', 'Pull request');
}

/** Explains a save workflow on hover; names the synchronized branch when the repository has one. */
export function getWorkflowDescription(workflow: WorkflowOption, branch?: string): string {
  if (workflow === 'write') {
    return branch
      ? t('provisioning.workflow.direct-push-description', 'Changes are committed straight to {{branch}}.', { branch })
      : t(
          'provisioning.workflow.direct-push-description-no-branch',
          'Changes are committed straight to the synchronized branch.'
        );
  }
  return branch
    ? t(
        'provisioning.workflow.pull-request-description',
        'Changes go to a new branch for review before merging into {{branch}}.',
        { branch }
      )
    : t(
        'provisioning.workflow.pull-request-description-no-branch',
        'Changes go to a new branch for review before merging.'
      );
}
