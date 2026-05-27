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
  userName?: string;
  userLogin?: string;
  userEmail?: string;
}

type TemplateKey = keyof CommitTemplateVars;
const TEMPLATE_VAR = /\{\{(action|resourceKind|resourceID|title|userName|userLogin|userEmail)\}\}/g;

const TRAILER_KEY = 'Grafana-saved-by';
// Match the trailer at the start of any line, case-insensitively, so a custom
// comment/template that already provides one isn't duplicated.
const TRAILER_PRESENT = new RegExp(`^${TRAILER_KEY}:`, 'im');

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
  return trimmed.replace(TEMPLATE_VAR, (_, key: TemplateKey) => vars[key] ?? '');
}

type SavedByVars = Pick<CommitTemplateVars, 'userName' | 'userLogin'>;

/**
 * Builds the `Grafana-saved-by: ...` git trailer for the supplied user, or
 * undefined if there isn't enough info to identify the user. We prefer the
 * full name when available and append the login in parentheses so the trailer
 * remains greppable even if the display name is empty or duplicated.
 */
function buildSavedByTrailer({ userName, userLogin }: SavedByVars): string | undefined {
  const name = userName?.trim();
  const login = userLogin?.trim();
  if (!name && !login) {
    return undefined;
  }
  if (name && login && name !== login) {
    return `${TRAILER_KEY}: ${name} (${login})`;
  }
  return `${TRAILER_KEY}: ${name || login}`;
}

/**
 * Appends the `Grafana-saved-by:` git trailer to a commit message. Skips when
 * the message already contains a trailer (so templates / user comments that
 * spell it out themselves don't end up with a duplicate).
 */
export function appendSavedByTrailer(message: string, vars: SavedByVars): string {
  const trailer = buildSavedByTrailer(vars);
  if (!trailer) {
    return message;
  }
  if (TRAILER_PRESENT.test(message)) {
    return message;
  }
  const trimmed = message.replace(/\s+$/, '');
  if (!trimmed) {
    return trailer;
  }
  // Git trailers live in a separate paragraph at the end of the message.
  return `${trimmed}\n\n${trailer}`;
}

interface SingleResourceCommitMessageArgs extends CommitTemplateVars {
  comment: string | undefined;
  repository: RepositoryView | undefined;
}

/**
 * Resolves the commit message for a single-resource UI operation. Whitespace-
 * only comments are treated as empty and fall through to the repo template
 * (or built-in default), so the user can't accidentally ship blank commits.
 * The `Grafana-saved-by:` trailer is appended in all three paths so the
 * Grafana user who triggered the commit is always recorded in git history.
 */
export function getSingleResourceCommitMessage({
  comment,
  repository,
  ...vars
}: SingleResourceCommitMessageArgs): string {
  const trimmed = comment?.trim();
  const base = trimmed ? trimmed : renderCommitMessage(repository?.commit?.singleResourceMessageTemplate, vars);
  return appendSavedByTrailer(base, vars);
}
