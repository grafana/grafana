import { SceneGridLayout, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardEditActionEvent } from '../../edit-pane/shared';
import { getQueryRunnerFor } from '../../utils/utils';
import { DashboardScene, DashboardSceneState } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { AutoGridItem } from './AutoGridItem';
import { AutoGridLayout } from './AutoGridLayout';
import { AutoGridLayoutManager } from './AutoGridLayoutManager';

describe('AutoGridLayoutManager', () => {
  it('can remove panel', () => {
    const { manager, panel1 } = setup();

    manager.subscribeToEvent(DashboardEditActionEvent, (event) => {
      event.payload.perform();
    });

    manager.removePanel(panel1);

    expect(manager.state.layout.state.children.length).toBe(1);
  });
  describe('createFromLayout', () => {
    it('preserves panel pluginId, title and options when creating from DefaultGridLayoutManager', () => {
      const defaultLayout = setupSceneWithDefaultGrid([getDefaultVizPanel()]);

      const autoLayout = AutoGridLayoutManager.createFromLayout(defaultLayout);

      const children = autoLayout.state.layout.state.children;
      expect(children).toHaveLength(1);
      const panel = (children[0] as AutoGridItem).state.body;
      expect(panel.state.pluginId).toBe(panelPluginId);
      expect(panel.state.title).toBe(panelTitle);
      expect(panel.state.options).toEqual(panelOptions);
    });

    it('preserves panel queries when creating from DefaultGridLayoutManager', () => {
      const defaultLayout = setupSceneWithDefaultGrid([getDefaultVizPanel()]);

      const autoLayout = AutoGridLayoutManager.createFromLayout(defaultLayout);

      const children = autoLayout.state.layout.state.children;
      const panel = (children[0] as AutoGridItem).state.body;
      const runner = getQueryRunnerFor(panel);
      expect(runner).toBeDefined();
      expect(runner?.state.queries).toEqual(queries);
    });

    it('preserves order of panels when creating AutoGridLayoutManager from DefaultGridLayoutManager', () => {
      const panelA = new VizPanel({ key: 'panel-a', title: 'Panel A', pluginId: 'table' });
      const panelB = new VizPanel({ key: 'panel-b', title: 'Panel B', pluginId: 'timeseries' });
      const panelC = new VizPanel({ key: 'panel-c', title: 'Panel C', pluginId: 'stat' });

      const layout = setupSceneWithDefaultGrid([panelA, panelB, panelC]);

      const autoLayout = AutoGridLayoutManager.createFromLayout(layout);

      const children = autoLayout.state.layout.state.children;
      expect(children).toHaveLength(3);
      expect(children[0]).toBeInstanceOf(AutoGridItem);
      expect(children[1]).toBeInstanceOf(AutoGridItem);
      expect(children[2]).toBeInstanceOf(AutoGridItem);
      expect((children[0] as AutoGridItem).state.body.state.title).toBe('Panel A');
      expect((children[1] as AutoGridItem).state.body.state.title).toBe('Panel B');
      expect((children[2] as AutoGridItem).state.body.state.title).toBe('Panel C');
    });

    it('preserves repeat variable (variableName) when creating AutoGridLayoutManager from DefaultGridLayoutManager', () => {
      const variableName = 'myRepeatVar';

      const dashboard = new DashboardScene({
        body: new DefaultGridLayoutManager({
          grid: new SceneGridLayout({
            children: [
              new DashboardGridItem({
                key: 'gi-1',
                x: 0,
                y: 0,
                width: 8,
                height: 6,
                body: getDefaultVizPanel(),
                variableName,
              }),
            ],
          }),
        }),
      });

      const autoLayout = AutoGridLayoutManager.createFromLayout(dashboard.state.body);

      const children = autoLayout.state.layout.state.children;
      expect(children).toHaveLength(1);
      expect(children[0]).toBeInstanceOf(AutoGridItem);
      expect((children[0] as AutoGridItem).state.variableName).toBe(variableName);
    });

    it('does not set variableName when DashboardGridItem has no repeat variable', () => {
      const layout = setupSceneWithDefaultGrid([getDefaultVizPanel()]);

      const autoLayout = AutoGridLayoutManager.createFromLayout(layout);

      const children = autoLayout.state.layout.state.children;
      expect(children).toHaveLength(1);
      expect((children[0] as AutoGridItem).state.variableName).toBeUndefined();
    });

    it('clones panels and does not reuse original panel instances', () => {
      const panelA = new VizPanel({ key: 'panel-a', title: 'Panel A', pluginId: 'table' });
      const panelB = new VizPanel({ key: 'panel-b', title: 'Panel B', pluginId: 'timeseries' });

      const layout = setupSceneWithDefaultGrid([panelA, panelB]);

      const autoLayout = AutoGridLayoutManager.createFromLayout(layout);

      const children = autoLayout.state.layout.state.children;
      const clonedBodyA = (children[0] as AutoGridItem).state.body;
      const clonedBodyB = (children[1] as AutoGridItem).state.body;

      expect(clonedBodyA).not.toBe(panelA);
      expect(clonedBodyB).not.toBe(panelB);
      expect(clonedBodyA.state.title).toBe(panelA.state.title);
      expect(clonedBodyB.state.title).toBe(panelB.state.title);
    });

    it('sets isDraggable to true when dashboard is in edit mode', () => {
      const layout = setupSceneWithDefaultGrid([getDefaultVizPanel], { isEditing: true });

      const autoLayout = AutoGridLayoutManager.createFromLayout(layout);

      expect(autoLayout.state.layout.state.isDraggable).toBe(true);
    });

    it('sets isDraggable to false when dashboard is not in edit mode', () => {
      const layout = setupSceneWithDefaultGrid([getDefaultVizPanel()], { isEditing: false });

      const autoLayout = AutoGridLayoutManager.createFromLayout(layout);

      expect(autoLayout.state.layout.state.isDraggable).toBe(false);
    });
  });
});

export function setup() {
  const panel1 = new VizPanel({
    title: 'Panel A',
    key: 'panel-1',
    pluginId: 'table',
    $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
  });

  const panel2 = new VizPanel({
    title: 'Panel A',
    key: 'panel-1',
    pluginId: 'table',
    $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
  });

  const gridItems = [
    new AutoGridItem({
      key: 'grid-item-1',
      body: panel1,
    }),
    new AutoGridItem({
      key: 'grid-item-2',
      body: new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    }),
  ];

  const manager = new AutoGridLayoutManager({ layout: new AutoGridLayout({ children: gridItems }) });

  new DashboardScene({ body: manager });

  return { manager, panel1, panel2 };
}

const panelOptions = { legend: { displayMode: 'list', placement: 'bottom' } };
const panelTitle = 'Test panel';
const panelPluginId = 'timeseries';
const queries = [{ refId: 'A', datasource: { type: 'test', uid: 'ds1' } }];

const getDefaultVizPanel = () =>
  new VizPanel({
    key: 'panel-1',
    pluginId: panelPluginId,
    title: panelTitle,
    options: panelOptions,
    $data: new SceneQueryRunner({ key: 'test', queries }),
  });

const setupSceneWithDefaultGrid = (panels: VizPanel[], sceneOptions?: Partial<DashboardSceneState>) => {
  const dashboard = new DashboardScene({
    ...sceneOptions,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: panels.map(
          (panel, index) =>
            new DashboardGridItem({ key: `gi-${index + 1}`, x: 0, y: 0, width: 8, height: 6, body: panel })
        ),
      }),
    }),
  });
  return dashboard.state.body;
};
