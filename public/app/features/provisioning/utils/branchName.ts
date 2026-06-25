import { type CommitTemplateVars } from './commitMessage';

// Branch templates use a subset of the commit variables plus {{random}}.
export type BranchTemplateVars = Pick<CommitTemplateVars, 'action' | 'resourceKind' | 'title' | 'userLogin'>;

const BRANCH_TEMPLATE_KEYS = ['action', 'resourceKind', 'title', 'userLogin', 'random'] as const;
type BranchTemplateKey = (typeof BRANCH_TEMPLATE_KEYS)[number];
const BRANCH_TEMPLATE_VAR = new RegExp(`\\{\\{(${BRANCH_TEMPLATE_KEYS.join('|')})\\}\\}`, 'g');

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** 6-char lowercase alphanumeric token. Generated once per drawer open to avoid branch-name collisions. */
export function generateBranchToken(length = 6): string {
  let token = '';
  for (let i = 0; i < length; i++) {
    token += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return token;
}

const DISALLOWED_CHARS = /[^a-z0-9/_-]+/g;
const SEPARATOR_RUN_WITH_SLASH = /[-/]*\/[-/]*/g;
const REPEATED_DASHES = /-{2,}/g;
const LEADING_OR_TRAILING_SEPARATORS = /^[/-]+|[/-]+$/g;
const TRAILING_SEPARATORS = /[/-]+$/g;
const MAX_BRANCH_NAME_LENGTH = 100;

/**
 * Sanitises a rendered branch name into a valid git ref: lowercase, only [a-z0-9/_-],
 * disallowed characters (including '.') collapsed to '-', adjacent separators collapsed (a run
 * containing '/' becomes a single '/', otherwise a single '-'), no leading/trailing '/' or '-',
 * max 100 chars. Returns '' when nothing valid remains. The output always satisfies
 * utils/git.ts `validateBranchName`.
 */
export function sanitizeBranchName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(DISALLOWED_CHARS, '-')
      // A separator run containing a '/' collapses to a single '/'; a dash-only run to a single '-'.
      .replace(SEPARATOR_RUN_WITH_SLASH, '/')
      .replace(REPEATED_DASHES, '-')
      .replace(LEADING_OR_TRAILING_SEPARATORS, '')
      .slice(0, MAX_BRANCH_NAME_LENGTH)
      // slice() can cut mid-separator, so trim the tail again.
      .replace(TRAILING_SEPARATORS, '')
  );
}

/**
 * Substitutes the branch/PR template variables in `template` with raw values (no sanitisation).
 * Unknown keys never match the regex; a recognised key with no value renders as ''. Assumes a
 * non-empty template. Shared by renderBranchName (which then sanitises to a git ref) and the
 * PR-title renderer (which keeps the result as free text).
 */
export function substituteBranchVars(template: string, vars: BranchTemplateVars & { random: string }): string {
  return template.replace(BRANCH_TEMPLATE_VAR, (_, key: BranchTemplateKey) => vars[key] ?? '');
}

/**
 * Renders branch.nameTemplate with the supplied vars and sanitises the result.
 * Returns '' for an empty/blank template so the caller keeps the auto-generated name.
 */
export function renderBranchName(
  template: string | undefined | null,
  vars: BranchTemplateVars & { random: string }
): string {
  const trimmed = template?.trim();
  if (!trimmed) {
    return '';
  }
  return sanitizeBranchName(substituteBranchVars(trimmed, vars));
}
