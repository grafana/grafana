import { t } from '@grafana/i18n';

import { noEscape, rich } from '../richText';
import {
  type ChangeKind,
  type NodeStatus,
  type ReviewCategory,
  type ReviewChange,
  type ReviewInput,
  type ReviewNode,
  type RichText,
} from '../types';

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
  text: RichText;
  /** Set when the node's name is ambiguous: its new 1-based position. */
  position?: number;
}

/**
 * What happened to a node, read after its label (WORDING.md §3): the move, "was updated (N changes)" for its
 * change lines, or both. Added and removed nodes are marked instead, and a node with neither (a header) has none.
 */
export function nodeStatusText(
  status: NodeStatus | undefined,
  move: NodeMove | undefined,
  lines: number
): RichText | undefined {
  if (status === 'added' || status === 'removed') {
    return undefined;
  }
  const moved = status === 'moved' ? move : undefined;
  if (moved && moved.position !== undefined) {
    const position = String(moved.position);
    if (!lines) {
      return rich({ move: moved.text, position }, (p) =>
        t('dashboard-scene.review.status.moved-at-position', '{{move}}, at position {{position}}', {
          ...p,
          interpolation: noEscape,
        })
      );
    }
    return rich({ move: moved.text, position }, (p) =>
      t('dashboard-scene.review.status.moved-at-position-and-updated', '', {
        ...p,
        count: lines,
        interpolation: noEscape,
        defaultValue_one: '{{move}}, at position {{position}}, and was updated ({{count}} change)',
        defaultValue_other: '{{move}}, at position {{position}}, and was updated ({{count}} changes)',
      })
    );
  }
  if (!lines) {
    return moved?.text;
  }
  if (moved) {
    return rich({ move: moved.text }, (p) =>
      t('dashboard-scene.review.status.moved-and-updated', '', {
        ...p,
        count: lines,
        interpolation: noEscape,
        defaultValue_one: '{{move}} and was updated ({{count}} change)',
        defaultValue_other: '{{move}} and was updated ({{count}} changes)',
      })
    );
  }
  return [
    t('dashboard-scene.review.status.updated', '', {
      count: lines,
      defaultValue_one: 'was updated ({{count}} change)',
      defaultValue_other: 'was updated ({{count}} changes)',
    }),
  ];
}

type ElementKindWord = 'panel' | 'row' | 'tab';

/**
 * "(3 panels moved to it, 1 panel added)": what an added section holds, read after its header. Moved-in elements
 * are the ones a layout change put there; added ones are its new direct children. Kinds are named when the
 * elements are all of one kind, "elements" otherwise. Undefined when it holds neither.
 */
export function sectionContentsText(movedIn: RichText[], added: ElementKindWord[]): RichText | undefined {
  const movedKinds = movedIn.map((content) => content.find((part) => typeof part !== 'string')?.kind);
  const parts = [
    ...(movedIn.length ? [movedInPart(oneKind(movedKinds), movedIn.length)] : []),
    ...(added.length ? [addedPart(oneKind(added), added.length)] : []),
  ];
  if (!parts.length) {
    return undefined;
  }
  return [
    t('dashboard-scene.review.status.section-contents', '({{parts, list(type: unit; style: short)}})', {
      parts,
      interpolation: noEscape,
    }),
  ];
}

function oneKind(kinds: Array<string | undefined>): string | undefined {
  const unique = new Set(kinds);
  return unique.size === 1 ? [...unique][0] : undefined;
}

function movedInPart(kind: string | undefined, count: number): string {
  switch (kind) {
    case 'panel':
      return t('dashboard-scene.review.status.moved-in-panels', '', {
        count,
        defaultValue_one: '{{count}} panel moved to it',
        defaultValue_other: '{{count}} panels moved to it',
      });
    case 'row':
      return t('dashboard-scene.review.status.moved-in-rows', '', {
        count,
        defaultValue_one: '{{count}} row moved to it',
        defaultValue_other: '{{count}} rows moved to it',
      });
    case 'tab':
      return t('dashboard-scene.review.status.moved-in-tabs', '', {
        count,
        defaultValue_one: '{{count}} tab moved to it',
        defaultValue_other: '{{count}} tabs moved to it',
      });
    default:
      return t('dashboard-scene.review.status.moved-in-elements', '', {
        count,
        defaultValue_one: '{{count}} element moved to it',
        defaultValue_other: '{{count}} elements moved to it',
      });
  }
}

function addedPart(kind: string | undefined, count: number): string {
  switch (kind) {
    case 'panel':
      return t('dashboard-scene.review.status.added-panels', '', {
        count,
        defaultValue_one: '{{count}} panel added',
        defaultValue_other: '{{count}} panels added',
      });
    case 'row':
      return t('dashboard-scene.review.status.added-rows', '', {
        count,
        defaultValue_one: '{{count}} row added',
        defaultValue_other: '{{count}} rows added',
      });
    case 'tab':
      return t('dashboard-scene.review.status.added-tabs', '', {
        count,
        defaultValue_one: '{{count}} tab added',
        defaultValue_other: '{{count}} tabs added',
      });
    default:
      return t('dashboard-scene.review.status.added-elements', '', {
        count,
        defaultValue_one: '{{count}} element added',
        defaultValue_other: '{{count}} elements added',
      });
  }
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

/** The top-level elements a save changes something in, by kind: a change inside a tab is a change to the tab. */
export interface TopLevelCounts {
  rows: number;
  tabs: number;
  panels: number;
}

export function overviewLine(dashboard: boolean, { rows, tabs, panels }: TopLevelCounts, isNew = false): string {
  const parts: string[] = [];
  if (dashboard) {
    parts.push(
      isNew && !parts.length
        ? t('dashboard-scene.review.overview.dashboard-first', 'The dashboard')
        : t('dashboard-scene.review.overview.dashboard', 'the dashboard')
    );
  }
  if (rows) {
    parts.push(
      isNew && !parts.length
        ? t('dashboard-scene.review.overview.rows-first', '', {
            count: rows,
            defaultValue_one: '{{count}} row',
            defaultValue_other: '{{count}} rows',
          })
        : t('dashboard-scene.review.overview.rows', '', {
            count: rows,
            defaultValue_one: '{{count}} row',
            defaultValue_other: '{{count}} rows',
          })
    );
  }
  if (tabs) {
    parts.push(
      isNew && !parts.length
        ? t('dashboard-scene.review.overview.tabs-first', '', {
            count: tabs,
            defaultValue_one: '{{count}} tab',
            defaultValue_other: '{{count}} tabs',
          })
        : t('dashboard-scene.review.overview.tabs', '', {
            count: tabs,
            defaultValue_one: '{{count}} tab',
            defaultValue_other: '{{count}} tabs',
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
/** Changes a line stands for: an element's grouped field changes count one each. */
export function changeCount(change: ReviewChange): number {
  return change.changes?.length ?? 1;
}

export function countChanges(tree: ReviewNode[], metadata: ReviewChange[]): Record<ChangeKind, number> {
  const counts: Record<ChangeKind, number> = { added: 0, changed: 0, removed: 0, moved: 0 };
  const visit = (node: ReviewNode) => {
    if (node.status) {
      counts[node.status]++;
    }
    node.categories.forEach((group) =>
      group.changes.forEach((change) => (change.changes ?? [change]).forEach((leaf) => counts[leaf.kind]++))
    );
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
