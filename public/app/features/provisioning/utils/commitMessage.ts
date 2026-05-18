import { t } from '@grafana/i18n';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

export type CommitAction = 'create' | 'update' | 'delete' | 'move' | 'rename';
export type CommitResourceKind = 'dashboard' | 'folder';
export type CommitResourceID = string;

export interface CommitTemplateVars {
  action: CommitAction;
  resourceKind: CommitResourceKind;
  resourceID: CommitResourceID;
  title: string;
}

const TEMPLATE_VAR = /\{\{(action|resourceKind|resourceID|title)\}\}/g;

function defaultMessage({ action, resourceKind, title }: CommitTemplateVars): string {
  // Full Record forces every (resourceKind, action) pair to be mapped, so any
  // future widening of either union is caught at compile time. The three pairs
  // that aren't reachable today (dashboard:rename, folder:update, folder:move)
  // get sensible defaults rather than a runtime fallback.
  const defaults: Record<`${CommitResourceKind}:${CommitAction}`, string> = {
    'dashboard:create': t('provisioning.commit-message.dashboard-create-default', 'New dashboard: {{title}}', {
      title,
    }),
    'dashboard:update': t('provisioning.commit-message.dashboard-update-default', 'Save dashboard: {{title}}', {
      title,
    }),
    'dashboard:delete': t('provisioning.commit-message.dashboard-delete-default', 'Delete dashboard: {{title}}', {
      title,
    }),
    'dashboard:move': t('provisioning.commit-message.dashboard-move-default', 'Move dashboard: {{title}}', { title }),
    'dashboard:rename': t('provisioning.commit-message.dashboard-rename-default', 'Rename dashboard: {{title}}', {
      title,
    }),
    'folder:create': t('provisioning.commit-message.folder-create-default', 'Create folder: {{title}}', { title }),
    'folder:update': t('provisioning.commit-message.folder-update-default', 'Save folder: {{title}}', { title }),
    'folder:delete': t('provisioning.commit-message.folder-delete-default', 'Delete folder: {{title}}', { title }),
    'folder:rename': t('provisioning.commit-message.folder-rename-default', 'Rename folder: {{title}}', { title }),
    'folder:move': t('provisioning.commit-message.folder-move-default', 'Move folder: {{title}}', { title }),
  };
  return defaults[`${resourceKind}:${action}`];
}

export function renderCommitMessage(template: string | undefined | null, vars: CommitTemplateVars): string {
  const trimmed = template?.trim();
  if (!trimmed) {
    return defaultMessage(vars);
  }
  return trimmed.replace(TEMPLATE_VAR, (_, key: keyof CommitTemplateVars) => vars[key]);
}

interface SingleResourceCommitMessageArgs extends CommitTemplateVars {
  comment: string | undefined;
  repository: RepositoryView | undefined;
}

/**
 * Resolves the commit message for a single-resource UI operation. Whitespace-
 * only comments are treated as empty and fall through to the repo template
 * (or built-in default), so the user can't accidentally ship blank commits.
 */
export function getSingleResourceCommitMessage({
  comment,
  repository,
  ...vars
}: SingleResourceCommitMessageArgs): string {
  const trimmed = comment?.trim();
  if (trimmed) {
    return trimmed;
  }
  return renderCommitMessage(repository?.commit?.singleResourceMessageTemplate, vars);
}
