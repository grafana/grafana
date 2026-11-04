import { t } from '@grafana/i18n';

import {
  type ChangeKind,
  type NodeStatus,
  type ReviewCategory,
  type ReviewChange,
  type ReviewInput,
  type ReviewNode,
} from '../types';

const noEscape = { escapeValue: false };

export function categoryLabel(category: ReviewCategory): string {
  switch (category) {
    case 'properties':
      return t('dashboard-scene.review.category.properties', 'Properties');
    case 'layout':
      return t('dashboard-scene.review.category.layout', 'Layout');
    case 'controls':
      return t('dashboard-scene.review.category.controls', 'Controls');
    case 'repeat':
      return t('dashboard-scene.review.category.repeat', 'Repeat');
    case 'showHide':
      return t('dashboard-scene.review.category.conditional-rendering', 'Conditional rendering');
    case 'data':
      return t('dashboard-scene.review.category.data', 'Data');
    case 'visualization':
      return t('dashboard-scene.review.category.visualization', 'Visualization');
    case 'pluginOptions':
      return t('dashboard-scene.review.category.plugin-options', 'Plugin options');
    case 'fieldConfig':
      return t('dashboard-scene.review.category.field-config', 'Field config');
    case 'other':
    default:
      return t('dashboard-scene.review.category.other', 'Other');
  }
}

/** The lowercase form used in a collapsed node's summary (lowercasing isn't safe in every language). */
export function categorySummaryLabel(category: ReviewCategory): string {
  switch (category) {
    case 'properties':
      return t('dashboard-scene.review.category-summary.properties', 'properties');
    case 'layout':
      return t('dashboard-scene.review.category-summary.layout', 'layout');
    case 'controls':
      return t('dashboard-scene.review.category-summary.controls', 'controls');
    case 'repeat':
      return t('dashboard-scene.review.category-summary.repeat', 'repeat');
    case 'showHide':
      return t('dashboard-scene.review.category-summary.conditional-rendering', 'conditional rendering');
    case 'data':
      return t('dashboard-scene.review.category-summary.data', 'data');
    case 'visualization':
      return t('dashboard-scene.review.category-summary.visualization', 'visualization');
    case 'pluginOptions':
      return t('dashboard-scene.review.category-summary.plugin-options', 'plugin options');
    case 'fieldConfig':
      return t('dashboard-scene.review.category-summary.field-config', 'field config');
    case 'other':
    default:
      return t('dashboard-scene.review.category-summary.other', 'other');
  }
}

/** How structure/ says a node moved: the text without the node's own position, and that position when needed. */
export interface NodeMove {
  text: string;
  /** Set when the node's name is ambiguous: its new 1-based position. */
  position?: number;
}

/**
 * What happened to a node, read after its label (WORDING.md §3): the move, "was updated (N changes)" for its
 * change lines, or both. Added and removed nodes are marked instead, and a node with neither (a header) has none.
 */
export function nodeStatusText(status: NodeStatus | undefined, move: NodeMove | undefined, lines: number) {
  if (status === 'added' || status === 'removed') {
    return undefined;
  }
  const moved = status === 'moved' ? move : undefined;
  if (moved && moved.position !== undefined) {
    const options = { move: moved.text, position: moved.position, interpolation: noEscape };
    if (!lines) {
      return t('dashboard-scene.review.status.moved-at-position', '{{move}}, at position {{position}}', options);
    }
    return t('dashboard-scene.review.status.moved-at-position-and-updated', '', {
      ...options,
      count: lines,
      defaultValue_one: '{{move}}, at position {{position}}, and was updated ({{count}} change)',
      defaultValue_other: '{{move}}, at position {{position}}, and was updated ({{count}} changes)',
    });
  }
  if (!lines) {
    return moved?.text;
  }
  if (moved) {
    return t('dashboard-scene.review.status.moved-and-updated', '', {
      move: moved.text,
      count: lines,
      interpolation: noEscape,
      defaultValue_one: '{{move}} and was updated ({{count}} change)',
      defaultValue_other: '{{move}} and was updated ({{count}} changes)',
    });
  }
  return t('dashboard-scene.review.status.updated', '', {
    count: lines,
    defaultValue_one: 'was updated ({{count}} change)',
    defaultValue_other: 'was updated ({{count}} changes)',
  });
}

/** "data, field config": the node's changed categories as a unit list. */
export function nodeSummary(categories: ReviewCategory[]): string {
  if (!categories.length) {
    return '';
  }
  return t('dashboard-scene.review.node.summary', '{{categories, list(type: unit; style: short)}}', {
    categories: categories.map(categorySummaryLabel),
    interpolation: noEscape,
  });
}

export function overviewLine(dashboard: boolean, sections: number, panels: number, isNew = false): string {
  const parts: string[] = [];
  if (dashboard) {
    parts.push(
      isNew && !parts.length
        ? t('dashboard-scene.review.overview.dashboard-first', 'The dashboard')
        : t('dashboard-scene.review.overview.dashboard', 'the dashboard')
    );
  }
  if (sections) {
    parts.push(
      isNew && !parts.length
        ? t('dashboard-scene.review.overview.sections-first', '', {
            count: sections,
            defaultValue_one: '{{count}} section',
            defaultValue_other: '{{count}} sections',
          })
        : t('dashboard-scene.review.overview.sections', '', {
            count: sections,
            defaultValue_one: '{{count}} section',
            defaultValue_other: '{{count}} sections',
          })
    );
  }
  if (panels) {
    parts.push(
      isNew && !parts.length
        ? t('dashboard-scene.review.overview.panels-first', '', {
            count: panels,
            defaultValue_one: '{{count}} panel',
            defaultValue_other: '{{count}} panels',
          })
        : t('dashboard-scene.review.overview.panels', '', {
            count: panels,
            defaultValue_one: '{{count}} panel',
            defaultValue_other: '{{count}} panels',
          })
    );
  }
  if (!parts.length) {
    return '';
  }
  // A new dashboard's intro already says "This creates a new dashboard with:", so its line is the bare list.
  return isNew
    ? t('dashboard-scene.review.overview.new-line', '{{parts, list}}', { parts, interpolation: noEscape })
    : t('dashboard-scene.review.overview.line', 'Changes to {{parts, list}}', { parts, interpolation: noEscape });
}

/** Every change line in the tree, every node with a status (once), and every Metadata line. */
export function countChanges(tree: ReviewNode[], metadata: ReviewChange[]): Record<ChangeKind, number> {
  const counts: Record<ChangeKind, number> = { added: 0, changed: 0, removed: 0, moved: 0 };
  const visit = (node: ReviewNode) => {
    if (node.status) {
      counts[node.status]++;
    }
    node.categories.forEach((group) => group.changes.forEach((change) => counts[change.kind]++));
    if (node.kind === 'section') {
      node.children.forEach(visit);
    }
  };
  tree.forEach(visit);
  metadata.forEach((change) => counts[change.kind]++);
  return counts;
}

export function describeMetadata(metadata: ReviewInput['metadata']): ReviewChange[] {
  const changes: ReviewChange[] = [];
  if (metadata?.folder) {
    const dashboards = t('dashboard-scene.review.metadata.root-folder', 'Dashboards');
    changes.push({
      kind: 'changed',
      text: t('dashboard-scene.review.metadata.folder', 'Folder: {{before}} → {{after}}', {
        before: metadata.folder.before || dashboards,
        after: metadata.folder.after || dashboards,
        interpolation: noEscape,
      }),
      claims: [],
    });
  }
  if (metadata?.predefinedVariables) {
    const none = t('dashboard-scene.review.metadata.no-predefined-variables', 'None');
    changes.push({
      kind: 'changed',
      text: t('dashboard-scene.review.metadata.predefined-variables', 'Predefined variables: {{before}} → {{after}}', {
        before: metadata.predefinedVariables.before || none,
        after: metadata.predefinedVariables.after || none,
        interpolation: noEscape,
      }),
      claims: [],
    });
  }
  return changes;
}
