import { richToPlain } from './richText';
import { type ChangeKind, type ReviewChange, type ReviewNode, type ReviewProperty, type ReviewSummary } from './types';

/** Stand-ins for the UI's green + and red − markers. */
const MARKERS: Record<ChangeKind, string> = { added: '+ ', removed: '- ', changed: '', moved: '' };

/**
 * Plain-text rendering of a ReviewSummary: the format the example corpus states its expectations in,
 * so a reviewer can judge how a summary reads without running the UI. Test-only; not user-facing.
 */
export function renderReviewText(summary: ReviewSummary, { details = true }: { details?: boolean } = {}): string {
  const lines: string[] = [];
  const push = (depth: number, text: string) => lines.push('  '.repeat(depth) + text);

  const pushChange = (depth: number, change: ReviewChange) => {
    const marker = change.subject ? MARKERS[change.kind] : '';
    push(depth, marker + change.text + (change.statusText ? ` ${change.statusText}` : ''));
    change.properties?.forEach((item) => pushProperty(depth + 1, item));
    change.changes?.forEach((inner) => pushChange(depth + 1, inner));
    if (details && change.details) {
      pushValue(depth + 1, 'before', change.details.before);
      pushValue(depth + 1, 'after', change.details.after);
    }
  };

  // A property's JSON is checked by unit tests; here only that there is something to Show.
  const pushProperty = (depth: number, item: ReviewProperty) =>
    push(
      depth,
      item.value !== undefined
        ? `· ${item.label}: ${item.value}`
        : item.details !== undefined
          ? `· ${item.label} [Show]`
          : `· ${item.label}`
    );

  const pushValue = (depth: number, name: string, value: string | undefined) => {
    const [first, ...rest] = (value ?? '(none)').split('\n');
    push(depth, `${name}: ${first}`);
    rest.forEach((line) => push(depth + 1, line));
  };

  const pushNode = (depth: number, node: ReviewNode) => {
    let header = (node.status ? MARKERS[node.status] : '') + richToPlain(node.label);
    if (node.statusText) {
      header += ` ${richToPlain(node.statusText)}`;
    }
    if (node.summary) {
      header += ` · ${node.summary}`;
    }
    push(depth, header);
    node.properties?.forEach((item) => pushProperty(depth + 1, item));
    for (const group of node.categories) {
      push(depth + 1, `[${group.label}${group.note ? ` ${group.note}` : ''}]`);
      group.changes.forEach((change) => pushChange(depth + 2, change));
    }
    if (node.kind === 'section') {
      // A moved-in element that also changed is shown once, as its node, in its place in the list.
      const childById = new Map(node.children.map((child) => [child.id, child]));
      const placed = new Set<string>();
      node.movedInContents?.forEach((name, index) => {
        const child = childById.get(node.movedInNodeIds?.[index] ?? '');
        if (child) {
          placed.add(child.id);
          pushNode(depth + 1, child);
        } else {
          push(depth + 1, `• ${richToPlain(name)}`);
        }
      });
      node.removedContents?.forEach((name) => push(depth + 1, `removed with it: ${richToPlain(name)}`));
      node.children.filter((child) => !placed.has(child.id)).forEach((child) => pushNode(depth + 1, child));
    }
  };

  if (summary.mode === 'new') {
    push(0, 'New dashboard');
  } else if (summary.mode === 'saveAsCopy') {
    push(0, `Copy of "${summary.sourceTitle ?? ''}"`);
  }
  if (summary.baselineKind === 'pendingChanges') {
    push(0, 'Baseline: pending changes');
  }
  if (!summary.tree.length && !summary.metadata.length && !summary.systemDefaults.length) {
    push(0, 'No changes to save');
    return lines.join('\n');
  }
  if (summary.overview.line) {
    push(0, summary.overview.line);
  }
  const { added, changed, removed, moved } = summary.overview.counts;
  push(0, `Counts: ${added} added, ${changed} changed, ${removed} removed, ${moved} moved`);
  if (summary.collapsePanelsByDefault) {
    push(0, 'Panels start collapsed');
  }

  summary.tree.forEach((node) => {
    lines.push('');
    pushNode(0, node);
  });

  if (summary.metadata.length) {
    lines.push('');
    push(0, `Metadata (${summary.metadata.length})`);
    summary.metadata.forEach((change) => pushChange(1, change));
  }

  if (summary.systemDefaults.length) {
    const count = summary.systemDefaults.reduce((total, group) => total + group.changes.length, 0);
    lines.push('');
    push(0, `System defaults (${count})`);
    for (const group of summary.systemDefaults) {
      push(1, richToPlain(group.label));
      group.changes.forEach((change) => pushChange(2, change));
    }
  }

  return lines.join('\n');
}
