import { type Diff } from '../../../settings/version-history/utils';
import { claimCovers, pathKey, type PathKey, type ReviewChange, type ReviewNode, type ReviewSummary } from '../types';

/** A claim and where it came from, so a failure can say which part of the summary made it. */
export interface OwnedClaim {
  claim: PathKey;
  owner: string;
}

export interface CompletenessReport {
  /** Diff paths no claim covers. */
  uncovered: PathKey[];
  /** Diff paths more than one claim covers, with the claims that do. */
  doubleCovered: Array<{ path: PathKey; claims: OwnedClaim[] }>;
  /** Claims that cover no diff path. */
  phantom: OwnedClaim[];
}

export function diffPathKeys(diffs: Record<string, Diff[]>): PathKey[] {
  return Object.values(diffs)
    .flat()
    .map((diff) => pathKey(diff.path));
}

/** Every claim in a summary: node claims, change claims (tree and system defaults), and bookkeeping. */
export function collectClaims(summary: ReviewSummary): OwnedClaim[] {
  const claims: OwnedClaim[] = [];
  const addChanges = (owner: string, changes: ReviewChange[]) =>
    changes.forEach((change) =>
      change.claims.forEach((claim) => claims.push({ claim, owner: `${owner}: ${change.text}` }))
    );

  const visit = (node: ReviewNode) => {
    node.claims.forEach((claim) => claims.push({ claim, owner: `${node.label} (node)` }));
    node.categories.forEach((group) => addChanges(`${node.label} [${group.label}]`, group.changes));
    if (node.kind === 'section') {
      node.children.forEach(visit);
    }
  };

  summary.tree.forEach(visit);
  summary.systemDefaults.forEach((group) => addChanges(`System defaults › ${group.label}`, group.changes));
  addChanges('Metadata', summary.metadata);
  summary.bookkeeping.forEach((claim) => claims.push({ claim, owner: 'bookkeeping' }));
  return claims;
}

/** Each diff path must be covered by exactly one claim, and each claim must cover at least one path. */
export function checkCompleteness(paths: PathKey[], claims: OwnedClaim[]): CompletenessReport {
  const report: CompletenessReport = { uncovered: [], doubleCovered: [], phantom: [] };

  for (const path of paths) {
    const covering = claims.filter(({ claim }) => claimCovers(claim, path));
    if (covering.length === 0) {
      report.uncovered.push(path);
    } else if (covering.length > 1) {
      report.doubleCovered.push({ path, claims: covering });
    }
  }

  report.phantom = claims.filter(({ claim }) => !paths.some((path) => claimCovers(claim, path)));
  return report;
}

export function isComplete(report: CompletenessReport): boolean {
  return !report.uncovered.length && !report.doubleCovered.length && !report.phantom.length;
}

export function formatCompletenessReport(report: CompletenessReport): string {
  const lines: string[] = [];
  if (report.uncovered.length) {
    lines.push('Uncovered diff paths:', ...report.uncovered.map((path) => `  ${path}`));
  }
  if (report.doubleCovered.length) {
    lines.push('Diff paths covered more than once:');
    report.doubleCovered.forEach(({ path, claims }) => {
      lines.push(`  ${path}`, ...claims.map(({ claim, owner }) => `    ${claim}  ← ${owner}`));
    });
  }
  if (report.phantom.length) {
    lines.push(
      'Claims that cover no diff path:',
      ...report.phantom.map(({ claim, owner }) => `  ${claim}  ← ${owner}`)
    );
  }
  return lines.join('\n');
}

/** Every user-facing text of a summary except the details (before/after values are shown as stored). */
export function collectTexts(summary: ReviewSummary): string[] {
  const texts: string[] = [summary.overview.line];
  const visit = (node: ReviewNode) => {
    texts.push(node.label, node.statusText ?? '', node.summary);
    node.categories.forEach((group) => texts.push(group.label, ...group.changes.map((change) => change.text)));
    if (node.kind === 'section') {
      texts.push(...(node.removedContents ?? []));
      node.children.forEach(visit);
    }
  };
  summary.tree.forEach(visit);
  summary.systemDefaults.forEach((group) => texts.push(group.label, ...group.changes.map((change) => change.text)));
  texts.push(...summary.metadata.map((change) => change.text));
  return texts.filter(Boolean);
}

const RAW_PATH_PATTERNS = [/\.spec\./, /\bspec\//, /vizConfig/, /fieldConfig/, /\belements\//, /\blayout\/spec\b/];

/** Texts that leak a raw spec path instead of a human label. */
export function findRawPathTexts(texts: string[]): string[] {
  return texts.filter((textValue) => RAW_PATH_PATTERNS.some((pattern) => pattern.test(textValue)));
}
