import { VizPanel } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';

import { FOCUS_HIGHLIGHT_MS, focusVizPanel } from './focusPanel';

function buildScene() {
  const first = new VizPanel({ title: 'First', pluginId: 'text', key: 'panel-1' });
  const second = new VizPanel({ title: 'Second', pluginId: 'timeseries', key: 'panel-2' });
  const tabs = new TabsLayoutManager({
    tabs: [
      new TabItem({ title: 'One', layout: DefaultGridLayoutManager.fromVizPanels([first]) }),
      new TabItem({ title: 'Two', layout: DefaultGridLayoutManager.fromVizPanels([second]) }),
    ],
  });
  new DashboardScene({ title: 'Focus', uid: 'focus', body: tabs });
  return { tabs, second };
}

describe('focusVizPanel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.innerHTML = '';
  });

  it('switches to the tab of the panel and scrolls its grid item into view', () => {
    const { tabs, second } = buildScene();
    const scrollIntoView = jest.spyOn(DashboardGridItem.prototype, 'scrollIntoView');

    focusVizPanel(second);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(tabs.getCurrentTab()?.state.title).toBe('Two');
  });

  it('highlights the rendered panel for a moment', () => {
    const { second } = buildScene();
    const element = document.createElement('div');
    element.setAttribute('data-viz-panel-key', 'panel-2');
    document.body.appendChild(element);

    focusVizPanel(second);
    expect(element.classList.length).toBe(1);

    jest.advanceTimersByTime(FOCUS_HIGHLIGHT_MS);
    expect(element.classList.length).toBe(0);
  });
});
