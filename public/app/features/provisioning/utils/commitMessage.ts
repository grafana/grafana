import { t } from '@grafana/i18n';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

export type CommitAction = 'create' | 'update' | 'delete' | 'move' | 'rename';
export type CommitResourceKind = 'dashboard' | 'folder';
type CommitResourceID = string;

export interface CommitTemplateVars {
  action: CommitAction;
  resourceKind: CommitResourceKind;
  resourceID: CommitResourceID;
  title: string;
  userName?: string;
  userLogin?: string;
  userEmail?: string;
}

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

function defaultMessage({ action, title }: Pick<CommitTemplateVars, 'action' | 'title'>): string {
  // Resource-agnostic by design: the verb and the noun ("resource") are part of each translatable
  // string rather than interpolated, so the messages localise cleanly (no fixed word order, no raw
  // English nouns) and every resource type — dashboards, folders, playlists and any new type —
  // shares the same copy. A repo can override this via singleResourceMessageTemplate (which can
  // reference {{resourceKind}}) when resource-specific phrasing is wanted.
  const defaults: Record<CommitAction, string> = {
    create: t('provisioning.commit-message.create-default', 'Create resource: {{title}}', { title }),
    update: t('provisioning.commit-message.update-default', 'Save resource: {{title}}', { title }),
    delete: t('provisioning.commit-message.delete-default', 'Delete resource: {{title}}', { title }),
    move: t('provisioning.commit-message.move-default', 'Move resource: {{title}}', { title }),
    rename: t('provisioning.commit-message.rename-default', 'Rename resource: {{title}}', { title }),
  };
  return defaults[action];
}

export function renderCommitMessage(template: string | undefined | null, vars: CommitTemplateVars): string {
  const trimmed = template?.trim();
  if (!trimmed) {
    return defaultMessage(vars);
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
