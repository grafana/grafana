import { FlagKeys } from '@grafana/runtime/internal';
import {
  defaultPanelSpec,
  type AutoGridLayoutItemKind,
  type Spec as DashboardV2Spec,
  type PanelKind,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';

import { deserializeAutoGridLayout, serializeAutoGridLayout } from './AutoGridLayoutSerializer';

const panelElement = (name: string, id: number): PanelKind => ({
  kind: 'Panel',
  spec: { ...defaultPanelSpec(), id, title: name },
});

const elements: DashboardV2Spec['elements'] = {
  'panel-a': panelElement('panel-a', 1),
  'panel-b': panelElement('panel-b', 2),
};

const item = (name: string, fitContent?: boolean): AutoGridLayoutItemKind => ({
  kind: 'AutoGridLayoutItem',
  spec: {
    element: { kind: 'ElementReference', name },
    ...(fitContent !== undefined ? { fitContent } : {}),
  },
});

// serializeAutoGridLayout returns the layout union; narrow it once for the assertions.
function serialize(manager: AutoGridLayoutManager) {
  const serialized = serializeAutoGridLayout(manager);
  if (serialized.kind !== 'AutoGridLayout') {
    throw new Error('expected AutoGridLayout');
  }
  return serialized;
}

// Layout spec fragments mirroring the "Min & max bounds" and "Item override" tabs of
// devenv/dev-dashboards/dashboard-auto-grid/content-fit-scenarios.json.
const minMaxBoundsLayout: DashboardV2Spec['layout'] = {
  kind: 'AutoGridLayout',
  spec: {
    maxColumnCount: 3,
    columnWidthMode: 'standard',
    rowHeightMode: 'standard',
    fitContent: true,
    minHeightMode: 'custom',
    minHeight: 100,
    maxHeightMode: 'custom',
    maxHeight: 400,
    matchRowHeights: false,
    items: [item('panel-a'), item('panel-b')],
  },
};

const itemOverrideLayout: DashboardV2Spec['layout'] = {
  kind: 'AutoGridLayout',
  spec: {
    maxColumnCount: 3,
    columnWidthMode: 'standard',
    rowHeightMode: 'standard',
    fitContent: false,
    matchRowHeights: false,
    items: [item('panel-a', true), item('panel-b')],
  },
};

afterEach(() => {
  setTestFlags({});
});

describe('deserialization', () => {
  it('resolves custom min/max height modes and content-fit flags', () => {
    const manager = deserializeAutoGridLayout(minMaxBoundsLayout, elements, false);

    expect(manager.state.fitContent).toBe(true);
    expect(manager.state.minHeight).toBe(100);
    expect(manager.state.maxHeightMode).toBe('custom');
    expect(manager.state.maxHeight).toBe(400);
    expect(manager.state.matchRowHeights).toBe(false);
  });

  it('resolves a named min height mode to its name', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'AutoGridLayout',
      spec: {
        columnWidthMode: 'standard',
        rowHeightMode: 'standard',
        minHeightMode: 'short',
        items: [],
      },
    };

    const manager = deserializeAutoGridLayout(layout, elements, false);

    expect(manager.state.minHeight).toBe('short');
  });

  it('resolves the "none" min height mode so panels can shrink to their content', () => {
    const layout: DashboardV2Spec['layout'] = {
      kind: 'AutoGridLayout',
      spec: {
        columnWidthMode: 'standard',
        rowHeightMode: 'standard',
        minHeightMode: 'none',
        items: [],
      },
    };

    const manager = deserializeAutoGridLayout(layout, elements, false);

    expect(manager.state.minHeight).toBe('none');
  });

  it('keeps per-item fit-content overrides as a tri-state', () => {
    const manager = deserializeAutoGridLayout(itemOverrideLayout, elements, false);

    const [first, second] = manager.state.layout.state.children;
    expect(first).toBeInstanceOf(AutoGridItem);
    expect((first as AutoGridItem).state.fitContent).toBe(true);
    expect((second as AutoGridItem).state.fitContent).toBeUndefined();
  });

  describe('with the auto-height panels flag enabled', () => {
    beforeEach(() => {
      setTestFlags({ [FlagKeys.GrafanaDashboardsAutoHeightPanels]: true });
    });

    it('lets rows grow when the layout default is fit-content', () => {
      const manager = deserializeAutoGridLayout(minMaxBoundsLayout, elements, false);

      expect(manager.state.layout.state.autoRows).toBe('minmax(320px, max-content)');
    });

    it('lets rows grow when only a single item opts into fit-content', () => {
      const manager = deserializeAutoGridLayout(itemOverrideLayout, elements, false);

      expect(manager.state.layout.state.autoRows).toBe('minmax(320px, max-content)');
    });

    it('keeps rows fixed when neither the layout nor any item opts in', () => {
      const layout: DashboardV2Spec['layout'] = {
        kind: 'AutoGridLayout',
        spec: {
          columnWidthMode: 'standard',
          rowHeightMode: 'standard',
          items: [item('panel-a')],
        },
      };

      const manager = deserializeAutoGridLayout(layout, elements, false);

      expect(manager.state.layout.state.autoRows).toBe('minmax(320px, 320px)');
    });
  });

  it('keeps rows fixed when the auto-height panels flag is disabled, even with fit-content persisted', () => {
    const manager = deserializeAutoGridLayout(minMaxBoundsLayout, elements, false);

    expect(manager.state.layout.state.autoRows).toBe('minmax(320px, 320px)');
  });
});

describe('serialization', () => {
  it('omits content-fit fields that match the defaults', () => {
    const manager = new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: [] }) });

    const serialized = serialize(manager);

    expect(serialized.spec.fitContent).toBeUndefined();
    expect(serialized.spec.fillScreen).toBeUndefined();
    expect(serialized.spec.minHeightMode).toBeUndefined();
    expect(serialized.spec.minHeight).toBeUndefined();
    expect(serialized.spec.maxHeightMode).toBeUndefined();
    expect(serialized.spec.maxHeight).toBeUndefined();
    expect(serialized.spec.matchRowHeights).toBeUndefined();
  });

  it('persists an unlimited max height as undefined', () => {
    const manager = new AutoGridLayoutManager({
      maxHeightMode: 'unlimited',
      maxHeight: 400,
      layout: new AutoGridLayout({ children: [] }),
    });

    const serialized = serialize(manager);

    expect(serialized.spec.maxHeightMode).toBeUndefined();
    expect(serialized.spec.maxHeight).toBeUndefined();
  });

  it('splits a numeric min height into custom mode plus pixels', () => {
    const manager = new AutoGridLayoutManager({
      minHeight: 100,
      layout: new AutoGridLayout({ children: [] }),
    });

    const serialized = serialize(manager);

    expect(serialized.spec.minHeightMode).toBe('custom');
    expect(serialized.spec.minHeight).toBe(100);
  });

  it('persists a "none" min height as its own mode without pixels', () => {
    const manager = new AutoGridLayoutManager({
      minHeight: 'none',
      layout: new AutoGridLayout({ children: [] }),
    });

    const serialized = serialize(manager);

    expect(serialized.spec.minHeightMode).toBe('none');
    expect(serialized.spec.minHeight).toBeUndefined();
  });

  it('persists matchRowHeights only when explicitly disabled', () => {
    const disabled = new AutoGridLayoutManager({
      matchRowHeights: false,
      layout: new AutoGridLayout({ children: [] }),
    });
    const enabled = new AutoGridLayoutManager({
      matchRowHeights: true,
      layout: new AutoGridLayout({ children: [] }),
    });

    expect(serialize(disabled).spec.matchRowHeights).toBe(false);
    expect(serialize(enabled).spec.matchRowHeights).toBeUndefined();
  });

  it('round-trips content-fit settings and per-item overrides', () => {
    // Serializing items resolves element ids through the scene, so the manager
    // must be attached to a DashboardScene.
    const attach = (manager: AutoGridLayoutManager) => {
      new DashboardScene({ body: manager });
      return manager;
    };

    const serialized = serialize(attach(deserializeAutoGridLayout(minMaxBoundsLayout, elements, false)));

    expect(serialized.spec.fitContent).toBe(true);
    expect(serialized.spec.minHeightMode).toBe('custom');
    expect(serialized.spec.minHeight).toBe(100);
    expect(serialized.spec.maxHeightMode).toBe('custom');
    expect(serialized.spec.maxHeight).toBe(400);
    expect(serialized.spec.matchRowHeights).toBe(false);

    const serializedOverrides = serialize(attach(deserializeAutoGridLayout(itemOverrideLayout, elements, false)));

    expect(serializedOverrides.spec.items[0].spec.fitContent).toBe(true);
    expect(serializedOverrides.spec.items[1].spec.fitContent).toBeUndefined();
  });
});
