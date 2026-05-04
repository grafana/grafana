import { t } from '@grafana/i18n';

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
  const defaults: Partial<Record<`${CommitResourceKind}:${CommitAction}`, string>> = {
    'dashboard:create': `New dashboard: ${title}`,
    'dashboard:update': `Save dashboard: ${title}`,
    'dashboard:delete': `Delete dashboard: ${title}`,
    'dashboard:move': `Move dashboard: ${title}`,
    'folder:create': `Create folder: ${title}`,
    'folder:rename': t('browse-dashboards.rename-provisioned-folder-form.commit', 'Rename folder'),
    'folder:delete': t('browse-dashboards.delete-provisioned-folder-form.commit', 'Delete folder'),
  };
  return defaults[`${resourceKind}:${action}`] ?? `Save ${resourceKind}: ${title}`;
}

export function renderCommitMessage(template: string | undefined | null, vars: CommitTemplateVars): string {
  const trimmed = template?.trim();
  if (!trimmed) {
    return defaultMessage(vars);
  }
  return trimmed.replace(TEMPLATE_VAR, (_, key: keyof CommitTemplateVars) => vars[key]);
}
