import { t } from '@grafana/i18n';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

type CommitAction = 'create' | 'update' | 'delete' | 'move' | 'rename';
type CommitResourceKind = 'dashboard' | 'folder';
type CommitResourceID = string;

interface BaseCommitTemplateVars {
  resourceID: CommitResourceID;
  title: string;
  userName?: string;
  userLogin?: string;
  userEmail?: string;
}

/** Single-resource operations always identify the resource by kind. */
export interface SingleResourceTemplateVars extends BaseCommitTemplateVars {
  action: CommitAction;
  resourceKind: CommitResourceKind;
}

/**
 * Bulk operations (delete/move) span multiple resources, so `resourceKind` is omitted (`never`).
 * Restricting `action` to the bulk-capable values also keeps single-resource callers honest: a
 * create/update/rename object that drops `resourceKind` won't accidentally match this variant.
 */
export interface BulkResourceTemplateVars extends BaseCommitTemplateVars {
  action: Extract<CommitAction, 'delete' | 'move'>;
  resourceKind?: never;
}

export type CommitTemplateVars = SingleResourceTemplateVars | BulkResourceTemplateVars;

// Single source of truth for the keys the template understands. The regex,
// the IDENTITY_KEYS set, and the TemplateKey type are all derived from these
// arrays — adding/removing a key here is enough to keep them in sync.
const IDENTITY_KEYS = ['userName', 'userLogin', 'userEmail'] as const satisfies ReadonlyArray<keyof CommitTemplateVars>;
const TEMPLATE_KEYS = [
  'action',
  'resourceKind',
  'resourceID',
  'title',
  ...IDENTITY_KEYS,
] as const satisfies ReadonlyArray<keyof CommitTemplateVars>;

type TemplateKey = (typeof TEMPLATE_KEYS)[number];

const TEMPLATE_VAR = new RegExp(`\\{\\{(${TEMPLATE_KEYS.join('|')})\\}\\}`, 'g');
const IDENTITY_KEY_SET: ReadonlySet<TemplateKey> = new Set(IDENTITY_KEYS);

const TRAILER_KEY = 'Grafana-saved-by';
// Match the trailer at the start of any line, case-insensitively, so a custom
// comment/template that already provides one isn't duplicated.
const TRAILER_PRESENT = new RegExp(`^${TRAILER_KEY}:`, 'im');

/**
 * Collapses any newline/CR into a single space and trims. Used on the
 * user-controlled identity fields (`name`, `login`, `email` come from
 * `UpdateUserCommand` which doesn't strip line breaks) so a profile value
 * like `"Ada\nGrafana-saved-by: forge"` can't inject forged git trailers
 * into the commit message.
 */
function sanitizeLine(value: string | undefined): string {
  return (value ?? '').replace(/[\r\n]+/g, ' ').trim();
}

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
  // Bulk callers always supply a `fallbackMessage`, so they never reach `defaultMessage` without a
  // kind. Single-resource callers always pass a concrete kind.
  if (!resourceKind) {
    return title;
  }
  return defaults[`${resourceKind}:${action}`];
}

/**
 * Renders the commit-message template against `vars`. When no template is configured the message
 * falls back to `fallbackMessage` if supplied (bulk callers pass their own multi-resource default),
 * otherwise to the single-resource built-in default.
 */
export function renderCommitMessage(
  template: string | undefined | null,
  vars: CommitTemplateVars,
  fallbackMessage?: string
): string {
  const trimmed = template?.trim();
  if (!trimmed) {
    return fallbackMessage ?? defaultMessage(vars);
  }
  return trimmed.replace(TEMPLATE_VAR, (_, key: TemplateKey) => {
    const raw = vars[key] ?? '';
    return IDENTITY_KEY_SET.has(key) ? sanitizeLine(raw) : raw;
  });
}

type SavedByVars = Pick<CommitTemplateVars, 'userName' | 'userLogin'>;

/**
 * Builds the `Grafana-saved-by: ...` git trailer for the supplied user, or
 * undefined if there isn't enough info to identify the user. We prefer the
 * full name when available and append the login in parentheses so the trailer
 * remains greppable even if the display name is empty or duplicated.
 */
function buildSavedByTrailer({ userName, userLogin }: SavedByVars): string | undefined {
  const name = sanitizeLine(userName);
  const login = sanitizeLine(userLogin);
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

type SingleResourceCommitMessageArgs = CommitTemplateVars & {
  comment: string | undefined;
  repository: RepositoryView | undefined;
};

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

type BulkResourceCommitMessageArgs = SingleResourceCommitMessageArgs & {
  /** Multi-resource default used when no repo template is configured. */
  fallbackMessage: string;
};

/**
 * Resolves the commit message for a multi-resource (bulk) UI operation. Identical to
 * {@link getSingleResourceCommitMessage} except the no-template fallback is the caller-supplied bulk
 * default (e.g. "Delete resources") instead of the single-resource built-in. The
 * `Grafana-saved-by:` trailer is still appended exactly once in every path.
 */
export function getBulkResourceCommitMessage({
  comment,
  repository,
  fallbackMessage,
  ...vars
}: BulkResourceCommitMessageArgs): string {
  const trimmed = comment?.trim();
  const base = trimmed
    ? trimmed
    : renderCommitMessage(repository?.commit?.singleResourceMessageTemplate, vars, fallbackMessage);
  return appendSavedByTrailer(base, vars);
}
