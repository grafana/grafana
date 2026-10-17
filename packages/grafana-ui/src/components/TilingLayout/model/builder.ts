import { sanitizeDocument } from './document';
import { createId, normalize } from './tree';
import { type Axis, type LayoutDocument, type LayoutNode, type PanelNode, type Rect, type ViewRecord } from './types';

export interface ViewSpec {
  kind: 'view';
  id: string;
  record: ViewRecord;
}

export interface PanelSpec {
  kind: 'panel';
  id?: string;
  selected?: number;
  views: ViewSpec[];
}

export interface SplitSpec {
  kind: 'split';
  id?: string;
  axis: Axis;
  weights?: number[];
  children: LayoutSpec[];
}

export type LayoutSpec = ViewSpec | PanelSpec | SplitSpec;

export interface FloatingSpec {
  panel: PanelSpec | ViewSpec;
  /** Fractions (0-1) of the workspace. */
  rect: Rect;
}

/**
 * Helpers to describe a layout in code. Compile the result with `createTilingDocument`.
 *
 * ```ts
 * const doc = createTilingDocument(
 *   tilingLayout.row([tilingLayout.view('a', { title: 'A' }), tilingLayout.column([...])], [2, 1])
 * );
 * ```
 */
export const tilingLayout = {
  view(id: string, record: ViewRecord = {}): ViewSpec {
    return { kind: 'view', id, record };
  },
  panel(...args: Array<ViewSpec | { id?: string; selected?: number }>): PanelSpec {
    const views = args.filter((a): a is ViewSpec => 'kind' in a && a.kind === 'view');
    const options = args.find((a): a is { id?: string; selected?: number } => !('kind' in a)) ?? {};
    return { kind: 'panel', views, ...options };
  },
  row(children: LayoutSpec[], weights?: number[], id?: string): SplitSpec {
    return { kind: 'split', axis: 'x', children, weights, id };
  },
  column(children: LayoutSpec[], weights?: number[], id?: string): SplitSpec {
    return { kind: 'split', axis: 'y', children, weights, id };
  },
};

export function createTilingDocument(spec: LayoutSpec | null, floating: FloatingSpec[] = []): LayoutDocument {
  const views: Record<string, ViewRecord> = {};

  const toPanel = (s: PanelSpec | ViewSpec): PanelNode => {
    const panelSpec: PanelSpec = s.kind === 'view' ? { kind: 'panel', views: [s] } : s;
    panelSpec.views.forEach((v) => {
      if (views[v.id]) {
        throw new Error(`Tiling layout: duplicate view id "${v.id}"`);
      }
      views[v.id] = v.record;
    });
    const ids = panelSpec.views.map((v) => v.id);
    return {
      kind: 'panel',
      id: panelSpec.id ?? createId('panel'),
      views: ids,
      selected: ids[panelSpec.selected ?? 0] ?? ids[0],
    };
  };

  const toNode = (s: LayoutSpec): LayoutNode => {
    if (s.kind === 'split') {
      return {
        kind: 'split',
        id: s.id ?? createId('split'),
        axis: s.axis,
        children: s.children.map(toNode),
        weights: s.weights ?? s.children.map(() => 1),
      };
    }
    return toPanel(s);
  };

  const root = spec ? normalize(toNode(spec)) : null;
  const floats = floating.map((f, i) => ({ panel: toPanel(f.panel), rect: f.rect, z: i + 1 }));
  return sanitizeDocument({ root, floating: floats, hidden: [], views });
}
