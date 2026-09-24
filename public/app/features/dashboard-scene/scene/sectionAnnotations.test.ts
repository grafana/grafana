import {
  dataLayers,
  SceneGridLayout,
  SceneQueryRunner,
  SceneVariableSet,
  TestVariable,
  VizPanel,
  sceneGraph,
  type MultiValueVariable,
} from '@grafana/scenes';

import { getAnnotationShowInPanels } from '../settings/annotations/AnnotationBasicOptions';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';
import { DashboardGridItem } from './layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { performRowRepeats } from './layout-rows/RowItemRepeater';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';
import { TabItem } from './layout-tabs/TabItem';
import { performTabRepeats } from './layout-tabs/TabItemRepeater';
import { TabsLayoutManager } from './layout-tabs/TabsLayoutManager';

function annotationLayer(name: string) {
  return new DashboardAnnotationsDataLayer({
    name,
    query: { name, enable: true, iconColor: 'red' },
  });
}

function gridWith(panel: VizPanel) {
  return new DefaultGridLayoutManager({
    grid: new SceneGridLayout({ children: [new DashboardGridItem({ body: panel })] }),
  });
}

describe('section annotations', () => {
  describe('layer overlay', () => {
    it('gives a panel its own query runner plus the section and dashboard layers, and not a sibling section', () => {
      const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }] });
      const panel = new VizPanel({ title: 'CPU', pluginId: 'timeseries', $data: runner });
      const nestedPanel = new VizPanel({ title: 'Nested', pluginId: 'timeseries' });
      const siblingPanel = new VizPanel({
        title: 'Memory',
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({ queries: [{ refId: 'A' }] }),
      });

      const sectionLayer = annotationLayer('section');
      const parentLayer = annotationLayer('parent');
      const dashboardLayer = annotationLayer('dashboard');
      const sectionSet = new DashboardDataLayerSet({ annotationLayers: [sectionLayer] });
      const parentSet = new DashboardDataLayerSet({ annotationLayers: [parentLayer] });
      const dashboardSet = new DashboardDataLayerSet({ annotationLayers: [dashboardLayer] });

      const sectionRow = new RowItem({
        title: 'Section',
        $data: sectionSet,
        layout: new RowsLayoutManager({
          rows: [
            new RowItem({ title: 'Panel row', layout: gridWith(panel) }),
            new RowItem({ title: 'Nested row', layout: gridWith(nestedPanel) }),
          ],
        }),
      });
      const siblingRow = new RowItem({ title: 'Sibling', layout: gridWith(siblingPanel) });

      new DashboardScene({
        $data: dashboardSet,
        body: new RowsLayoutManager({
          rows: [
            new RowItem({
              title: 'Parent',
              $data: parentSet,
              layout: new RowsLayoutManager({ rows: [sectionRow] }),
            }),
            siblingRow,
          ],
        }),
      });

      expect(sceneGraph.getData(panel)).toBe(runner);
      expect(sceneGraph.getDataLayers(panel)).toEqual(expect.arrayContaining([sectionSet, parentSet, dashboardSet]));
      expect(sceneGraph.getDataLayers(nestedPanel)).toEqual(
        expect.arrayContaining([sectionSet, parentSet, dashboardSet])
      );
      expect(sceneGraph.getDataLayers(siblingPanel)).toContain(dashboardSet);
      expect(sceneGraph.getDataLayers(siblingPanel)).not.toContain(sectionSet);
      expect(sceneGraph.getDataLayers(siblingPanel)).not.toContain(parentSet);
    });
  });

  describe('Show in', () => {
    it('lists panels inside the section, including nested panels, and not a sibling section', () => {
      const nested = new VizPanel({ title: 'Nested', pluginId: 'timeseries' });
      const sibling = new VizPanel({ title: 'Sibling', pluginId: 'timeseries' });
      const layer = annotationLayer('deploys');
      const sectionSet = new DashboardDataLayerSet({ annotationLayers: [layer] });
      const dashboardLayer = annotationLayer('dashboard');
      const dashboardSet = new DashboardDataLayerSet({ annotationLayers: [dashboardLayer] });

      const sectionRow = new RowItem({
        title: 'Section',
        $data: sectionSet,
        layout: new RowsLayoutManager({
          rows: [new RowItem({ title: 'Inner', layout: gridWith(nested) })],
        }),
      });
      const siblingRow = new RowItem({ title: 'Sibling', layout: gridWith(sibling) });

      new DashboardScene({
        $data: dashboardSet,
        body: new RowsLayoutManager({ rows: [sectionRow, siblingRow] }),
      });

      expect(getAnnotationShowInPanels(layer).map((panel) => panel.state.title)).toEqual(['Nested']);
      expect(
        getAnnotationShowInPanels(dashboardLayer)
          .map((panel) => panel.state.title)
          .sort()
      ).toEqual(['Nested', 'Sibling']);
    });
  });

  describe('clones', () => {
    it('gives a duplicated row its own layer objects', () => {
      const layer = annotationLayer('deploys');
      const set = new DashboardDataLayerSet({ annotationLayers: [layer] });
      const row = new RowItem({
        title: 'Row',
        $data: set,
        layout: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
      });

      const copy = row.duplicate();
      const copySet = copy.state.$data;

      expect(copySet).toBeInstanceOf(DashboardDataLayerSet);
      expect(copySet).not.toBe(set);
      expect(copySet instanceof DashboardDataLayerSet && copySet.state.annotationLayers[0]).not.toBe(layer);
      expect(copySet instanceof DashboardDataLayerSet && copySet.state.annotationLayers[0].state.name).toBe('deploys');
    });

    it('does not share layer instances across row or tab repeat clones', () => {
      const variable = new TestVariable({
        name: 'server',
        query: 'A.*',
        value: ['A', 'B'],
        text: ['A', 'B'],
        isMulti: true,
        optionsToReturn: [
          { label: 'A', value: 'A' },
          { label: 'B', value: 'B' },
        ],
      });

      const rowLayer = annotationLayer('row-deploys');
      const rowSet = new DashboardDataLayerSet({ annotationLayers: [rowLayer] });
      const row = new RowItem({
        key: 'row-1',
        title: 'Row ${server}',
        repeatByVariable: 'server',
        $data: rowSet,
        layout: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
      });
      new DashboardScene({
        $variables: new SceneVariableSet({ variables: [variable] }),
        body: new RowsLayoutManager({ rows: [row] }),
      });

      performRowRepeats(variable as unknown as MultiValueVariable, row, true);

      const rowClone = row.state.repeatedRows?.[0];
      const rowCloneSet = rowClone?.state.$data;
      expect(rowCloneSet).toBeInstanceOf(DashboardDataLayerSet);
      expect(rowCloneSet).not.toBe(rowSet);
      expect(rowCloneSet instanceof DashboardDataLayerSet && rowCloneSet.state.annotationLayers[0]).not.toBe(rowLayer);

      const tabVariable = new TestVariable({
        name: 'region',
        query: 'A.*',
        value: ['east', 'west'],
        text: ['east', 'west'],
        isMulti: true,
        optionsToReturn: [
          { label: 'east', value: 'east' },
          { label: 'west', value: 'west' },
        ],
      });
      const tabLayer = annotationLayer('tab-deploys');
      const tabSet = new DashboardDataLayerSet({ annotationLayers: [tabLayer] });
      const tab = new TabItem({
        key: 'tab-1',
        title: 'Tab ${region}',
        repeatByVariable: 'region',
        $data: tabSet,
        layout: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
      });
      new DashboardScene({
        $variables: new SceneVariableSet({ variables: [tabVariable] }),
        body: new TabsLayoutManager({ tabs: [tab] }),
      });

      performTabRepeats(tabVariable as unknown as MultiValueVariable, tab, true);

      const tabClone = tab.state.repeatedTabs?.[0];
      const tabCloneSet = tabClone?.state.$data;
      expect(tabCloneSet).toBeInstanceOf(DashboardDataLayerSet);
      expect(tabCloneSet).not.toBe(tabSet);
      expect(tabCloneSet instanceof DashboardDataLayerSet && tabCloneSet.state.annotationLayers[0]).not.toBe(tabLayer);
    });
  });

  describe('query gating', () => {
    let runLayer: jest.SpyInstance;

    beforeEach(() => {
      runLayer = jest.spyOn(dataLayers.AnnotationsDataLayer.prototype, 'runLayer').mockImplementation(() => undefined);
    });

    afterEach(() => {
      runLayer.mockRestore();
    });

    it('does not query an inactive tab, and starts when that tab becomes current', () => {
      const layer = annotationLayer('tab-deploys');
      const set = new DashboardDataLayerSet({ annotationLayers: [layer] });
      const tabA = new TabItem({
        title: 'A',
        $data: set,
        layout: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
      });
      const tabB = new TabItem({
        title: 'B',
        layout: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
      });
      const tabs = new TabsLayoutManager({ tabs: [tabA, tabB] });
      tabs.setState({ currentTabSlug: tabB.getSlug() });

      const deactivate = set.activate();
      expect(layer.isActive).toBe(false);
      expect(runLayer).not.toHaveBeenCalled();

      tabs.setState({ currentTabSlug: tabA.getSlug() });
      expect(layer.isActive).toBe(true);
      expect(runLayer).toHaveBeenCalledTimes(1);

      tabs.setState({ currentTabSlug: tabB.getSlug() });
      expect(layer.isActive).toBe(false);

      deactivate();
    });

    it('does not query a collapsed row, and starts when the row expands', () => {
      const layer = annotationLayer('row-deploys');
      const set = new DashboardDataLayerSet({ annotationLayers: [layer] });
      const row = new RowItem({
        title: 'Row',
        collapse: true,
        $data: set,
        layout: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
      });

      const deactivate = set.activate();
      expect(layer.isActive).toBe(false);
      expect(runLayer).not.toHaveBeenCalled();

      row.setState({ collapse: false });
      expect(layer.isActive).toBe(true);
      expect(runLayer).toHaveBeenCalledTimes(1);

      row.setState({ collapse: true });
      expect(layer.isActive).toBe(false);

      deactivate();
    });

    it('does not query a nested row while an ancestor row is collapsed or an ancestor tab is inactive', () => {
      const layer = annotationLayer('nested');
      const set = new DashboardDataLayerSet({ annotationLayers: [layer] });
      const child = new RowItem({
        title: 'Child',
        collapse: false,
        $data: set,
        layout: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
      });
      const parent = new RowItem({
        title: 'Parent',
        collapse: true,
        layout: new RowsLayoutManager({ rows: [child] }),
      });
      new DashboardScene({ body: new RowsLayoutManager({ rows: [parent] }) });

      const deactivate = set.activate();
      expect(layer.isActive).toBe(false);

      parent.setState({ collapse: false });
      expect(layer.isActive).toBe(true);
      deactivate();
      runLayer.mockClear();

      const tabLayer = annotationLayer('in-tab');
      const tabSet = new DashboardDataLayerSet({ annotationLayers: [tabLayer] });
      const inner = new RowItem({
        title: 'Inner',
        collapse: false,
        $data: tabSet,
        layout: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
      });
      const inactiveTab = new TabItem({
        title: 'Hidden',
        layout: new RowsLayoutManager({ rows: [inner] }),
      });
      const currentTab = new TabItem({
        title: 'Visible',
        layout: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
      });
      const tabs = new TabsLayoutManager({ tabs: [inactiveTab, currentTab] });
      tabs.setState({ currentTabSlug: currentTab.getSlug() });

      const stop = tabSet.activate();
      expect(tabLayer.isActive).toBe(false);
      expect(runLayer).not.toHaveBeenCalled();
      stop();
    });

    it('still queries dashboard layers', () => {
      const layer = annotationLayer('dashboard');
      const set = new DashboardDataLayerSet({ annotationLayers: [layer] });
      new DashboardScene({
        $data: set,
        body: new RowsLayoutManager({ rows: [] }),
      });

      const deactivate = set.activate();
      expect(layer.isActive).toBe(true);
      expect(runLayer).toHaveBeenCalledTimes(1);
      deactivate();
    });
  });
});
