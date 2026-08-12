import { act, screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { EventBusSrv, type PanelProps } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { config, setAppEvents, setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, VizPanel } from '@grafana/scenes';
import { contextSrv } from 'app/core/services/context_srv';

import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { findAdjacentVizPanel, focusVizPanel, generateUniqueTitle, getIsLazy } from './utils';

describe('getIsLazy', () => {
  const originalUser = contextSrv.user;
  const originalDefault = config.dashboardDefaultPreload;

  beforeEach(() => {
    contextSrv.user = { ...originalUser, authenticatedBy: '' };
    config.dashboardDefaultPreload = false;
  });

  afterAll(() => {
    contextSrv.user = originalUser;
    config.dashboardDefaultPreload = originalDefault;
  });

  it('is not lazy when preload is true', () => {
    expect(getIsLazy(true)).toBe(false);
  });

  it('is lazy when preload is false', () => {
    expect(getIsLazy(false)).toBe(true);
  });

  it('is lazy when preload is undefined', () => {
    expect(getIsLazy(undefined)).toBe(true);
  });

  // default_preload seeds new dashboards at creation time only. If it were read here, switching it
  // on would silently change every existing dashboard that has no preload value.
  it('ignores the instance default', () => {
    config.dashboardDefaultPreload = true;
    expect(getIsLazy(undefined)).toBe(true);
    expect(getIsLazy(false)).toBe(true);
  });

  it('is never lazy for the image renderer user', () => {
    contextSrv.user = { ...originalUser, authenticatedBy: 'render' };
    expect(getIsLazy(false)).toBe(false);
    expect(getIsLazy(undefined)).toBe(false);
  });
});

describe('generateUniqueTitle', () => {
  it('should return the original title if it is not in the existing titles', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['Other Title', 'Another Title']);
    expect(generateUniqueTitle(title, existingTitles)).toBe(title);
  });

  it('should handle undefined title by using empty string as base', () => {
    const existingTitles = new Set<string>(['Title 1', 'Title 2']);
    expect(generateUniqueTitle(undefined, existingTitles)).toBe('');
  });

  it('should append "1" to a title that does not end with a number', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['My Title']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 1');
  });

  it('should increment a number at the end of a title', () => {
    const title = 'My Title 1';
    const existingTitles = new Set<string>(['My Title 1', 'My Title 2']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 3');
  });

  it('should handle multiple increments when needed', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>(['My Title', 'My Title 1', 'My Title 2', 'My Title 3']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 4');
  });

  it('should handle titles with multiple numbers', () => {
    const title = 'My Title 123';
    const existingTitles = new Set<string>(['My Title 123', 'My Title 124']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title 125');
  });

  it('should handle titles with spaces before the number', () => {
    const title = 'My Title  1';
    const existingTitles = new Set<string>(['My Title  1', 'My Title  2']);
    expect(generateUniqueTitle(title, existingTitles)).toBe('My Title  3');
  });

  it('should handle empty existing titles set', () => {
    const title = 'My Title';
    const existingTitles = new Set<string>();
    expect(generateUniqueTitle(title, existingTitles)).toBe(title);
  });
});

describe('findAdjacentVizPanel', () => {
  const a = new VizPanel({ key: 'panel-a', pluginId: 'table' });
  const b = new VizPanel({ key: 'panel-b', pluginId: 'table' });
  const c = new VizPanel({ key: 'panel-c', pluginId: 'table' });

  it('returns the next sibling when one exists', () => {
    const siblings = [{ panel: a }, { panel: b }, { panel: c }];
    expect(findAdjacentVizPanel(siblings[1], siblings, (s) => s.panel)).toBe(c);
  });

  it('falls back to the previous sibling when removing the last item', () => {
    const siblings = [{ panel: a }, { panel: b }, { panel: c }];
    expect(findAdjacentVizPanel(siblings[2], siblings, (s) => s.panel)).toBe(b);
  });

  it('skips siblings whose getPanel returns undefined, such as rows', () => {
    const siblings = [{ panel: a }, { panel: undefined }, { panel: c }];
    expect(findAdjacentVizPanel(siblings[0], siblings, (s) => s.panel)).toBe(c);
  });

  it('returns undefined when the removed item is not in siblings', () => {
    const siblings = [{ panel: a }];
    expect(findAdjacentVizPanel({ panel: b }, siblings, (s) => s.panel)).toBeUndefined();
  });

  it('returns undefined when there are no other panels', () => {
    const siblings = [{ panel: a }];
    expect(findAdjacentVizPanel(siblings[0], siblings, (s) => s.panel)).toBeUndefined();
  });
});

describe('focusVizPanel', () => {
  function TestPanel(props: PanelProps) {
    return <div>{props.title}</div>;
  }

  beforeAll(() => {
    setPluginImportUtils({
      importPanelPlugin: () => Promise.resolve(getPanelPlugin({ id: 'table' }, TestPanel)),
      getPanelPluginFromCache: () => undefined,
    });
    // PanelChrome publishes a SetPanelAttentionEvent on focus; needs an app event bus to exist.
    setAppEvents(new EventBusSrv());
  });

  async function renderPanels(panels: VizPanel[]) {
    const scene = new DashboardScene({
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: new AutoGridLayoutManager({
        layout: new AutoGridLayout({
          children: panels.map((panel, index) => new AutoGridItem({ key: `auto-grid-item-${index}`, body: panel })),
        }),
      }),
    });

    render(<scene.Component model={scene} />);
    // Panels load their plugin asynchronously and update state on resolve; flush that inside act()
    // so the pending update doesn't leak out of the test.
    await act(async () => {});
  }

  it('moves focus to the given panel', async () => {
    const panelA = new VizPanel({ title: 'Panel A', key: 'panel-a', pluginId: 'table' });
    const panelB = new VizPanel({ title: 'Panel B', key: 'panel-b', pluginId: 'table' });
    await renderPanels([panelA, panelB]);

    await act(async () => {
      focusVizPanel(panelB);
      // focusVizPanel defers to the next animation frame
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(document.activeElement).toBe(screen.getByTestId(selectors.components.Panels.Panel.title('Panel B')));
  });

  it('does nothing when panel is undefined', async () => {
    const panelA = new VizPanel({ title: 'Panel A', key: 'panel-a', pluginId: 'table' });
    await renderPanels([panelA]);

    const activeElementBefore = document.activeElement;
    focusVizPanel(undefined);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(document.activeElement).toBe(activeElementBefore);
  });
});
