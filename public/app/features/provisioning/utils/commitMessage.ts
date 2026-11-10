import { t } from '@grafana/i18n';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

type CommitAction = 'create' | 'update' | 'delete' | 'move' | 'rename';
type CommitResourceKind = string;
type CommitResourceID = string;

interface BaseCommitTemplateVars {
  resourceID: CommitResourceID;
  title: string;
  userName?: string;
  userLogin?: string;
  userEmail?: string;
}

/** Single-resource operations always identify the resource by kind. */
interface SingleResourceTemplateVars extends BaseCommitTemplateVars {
  action: CommitAction;
  resourceKind: CommitResourceKind;
}

/**
 * Bulk operations (delete/move) span multiple resources, so `resourceKind` is omitted (`never`).
 * Restricting `action` to the bulk-capable values also keeps single-resource callers honest: a
 * create/update/rename object that drops `resourceKind` won't accidentally match this variant.
 */
interface BulkResourceTemplateVars extends BaseCommitTemplateVars {
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

function defaultMessage({
  action,
  resourceKind,
  title,
}: Pick<CommitTemplateVars, 'action' | 'resourceKind' | 'title'>): string {
  const defaults: Record<CommitAction, string> = {
    create: t('provisioning.commit-message.create-default', 'Create {{resourceKind}}: {{title}}', {
      resourceKind,
      title,
    }),
    update: t('provisioning.commit-message.update-default', 'Save {{resourceKind}}: {{title}}', {
      resourceKind,
      title,
    }),
    delete: t('provisioning.commit-message.delete-default', 'Delete {{resourceKind}}: {{title}}', {
      resourceKind,
      title,
    }),
    move: t('provisioning.commit-message.move-default', 'Move {{resourceKind}}: {{title}}', { resourceKind, title }),
    rename: t('provisioning.commit-message.rename-default', 'Rename {{resourceKind}}: {{title}}', {
      resourceKind,
      title,
    }),
  };
  // Bulk callers always supply a `fallbackMessage`, so they never reach `defaultMessage` without a
  // kind. Single-resource callers always pass a concrete kind.
  if (!resourceKind) {
    return title;
  }
  return defaults[action];
}

/**
 * Renders the commit-message template against `vars`. When no template is configured the message
 * falls back to `fallbackMessage` if it has non-whitespace content otherwise to the single-resource built-in default.
 */
export function renderCommitMessage(
  template: string | undefined | null,
  vars: CommitTemplateVars,
  fallbackMessage?: string
): string {
  const trimmed = template?.trim();
  if (!trimmed) {
    return fallbackMessage?.trim() ? fallbackMessage : defaultMessage(vars);
  }
  // Bulk operations omit `resourceKind`, so substitute a generic noun. Otherwise a
  // `{{resourceKind}}` placeholder would collapse to an empty token — e.g. a `feat({{resourceKind}}s)`
  // template would render `feat(s)` instead of `feat(resources)`
  const resourceKind = vars.resourceKind || t('provisioning.commit-message.bulk-resource-kind', 'resource');
  return trimmed.replace(TEMPLATE_VAR, (_, key: TemplateKey) => {
    if (key === 'resourceKind') {
      return resourceKind;
    }
    const raw = vars[key] ?? '';
    return IDENTITY_KEY_SET.has(key) ? sanitizeLine(raw) : raw;
  });
}

type ResourceCommitMessageArgs = CommitTemplateVars & {
  comment: string | undefined;
  repository: RepositoryView | undefined;
  /**
   * Multi-resource default used when no repo template is configured (e.g. "Delete resources"). Used
   * verbatim when it has non-whitespace content; an empty/whitespace-only value is treated as absent
   * and falls through to the built-in default rather than producing a blank commit.
   */
  fallbackMessage?: string;
};

/**
 * Resolves the commit message for a UI operation: a non-blank comment wins, otherwise the repo template
 * (or `fallbackMessage` / built-in default). Whitespace-only comments are treated as empty so the user
 * can't accidentally ship blank commits.
 */
export function getResourceCommitMessage({
  comment,
  repository,
  fallbackMessage,
  ...vars
}: ResourceCommitMessageArgs): string {
  return (
    comment?.trim() || renderCommitMessage(repository?.commit?.singleResourceMessageTemplate, vars, fallbackMessage)
  );
}
