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

/**
 * Sanitises a rendered branch name into a valid git ref: lowercase, only [a-z0-9/_-],
 * disallowed characters (including '.') collapsed to '-', adjacent separators collapsed (a run
 * containing '/' becomes a single '/', otherwise a single '-'), no leading/trailing '/' or '-',
 * max 100 chars. Returns '' when nothing valid remains. The output always satisfies
 * utils/git.ts `validateBranchName`.
 */
export function sanitizeBranchName(name: string): string {
  let s = name.trim().toLowerCase();
  s = s.replace(/[^a-z0-9/_-]+/g, '-');
  // Collapse a run of separators: any run containing a '/' becomes a single '/', otherwise a '-'.
  s = s.replace(/[-/]*\/[-/]*/g, '/');
  s = s.replace(/-{2,}/g, '-');
  s = s.replace(/^[/-]+|[/-]+$/g, '');
  s = s.slice(0, 100);
  s = s.replace(/[/-]+$/g, '');
  return s;
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
  const substituted = trimmed.replace(BRANCH_TEMPLATE_VAR, (_, key: BranchTemplateKey) => vars[key] ?? '');
  return sanitizeBranchName(substituted);
}
