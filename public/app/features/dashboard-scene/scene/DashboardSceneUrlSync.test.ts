import { locationService } from '@grafana/runtime';
import { SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { DashboardScene } from './DashboardScene';
import { DefaultGridLayoutManager } from './layout-default/DefaultGridLayoutManager';
import { RowItem } from './layout-rows/RowItem';
import { RowsLayoutManager } from './layout-rows/RowsLayoutManager';

describe('DashboardSceneUrlSync', () => {
  describe('Given a standard scene', () => {
    it('Should set UNSAFE_fitPanels when url has autofitpanels', () => {
      const scene = buildTestScene();
      scene.urlSync?.updateFromUrl({ autofitpanels: '' });
      const layout = scene.state.body as DefaultGridLayoutManager;

      expect(layout.state.grid.state.UNSAFE_fitPanels).toBe(true);
    });

    it('Should get the autofitpanels from the scene state', () => {
      const scene = buildTestScene();

      expect(scene.urlSync?.getUrlState().autofitpanels).toBeUndefined();
      const layout = scene.state.body as DefaultGridLayoutManager;
      layout.state.grid.setState({ UNSAFE_fitPanels: true });
      expect(scene.urlSync?.getUrlState().autofitpanels).toBe('true');
    });
  });

  describe('Scroll to row', () => {
    let scrollIntoViewSpy: jest.Mock;
    let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView;
    let locationPartialSpy: jest.SpyInstance;

    beforeEach(() => {
      // jsdom doesn't implement scrollIntoView, so patch the prototype rather than spy on it.
      originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
      scrollIntoViewSpy = jest.fn();
      HTMLElement.prototype.scrollIntoView = scrollIntoViewSpy;
      locationPartialSpy = jest.spyOn(locationService, 'partial').mockImplementation(() => {});
    });

    afterEach(() => {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
      locationPartialSpy.mockRestore();
      document.body.innerHTML = '';
    });

    it('scrolls the matching row into view', () => {
      const { scene, element } = buildTestSceneWithRow('Traces Instance Stats');

      scene.urlSync?.updateFromUrl({ srow: 'Traces-Instance-Stats' });

      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(element);
    });

    it('expands a collapsed row', () => {
      const { scene, row } = buildTestSceneWithRow('Traces Instance Stats', { collapse: true });

      scene.urlSync?.updateFromUrl({ srow: 'Traces-Instance-Stats' });

      expect(row.state.collapse).toBe(false);
    });

    it('clears parameter from the url after scrolling so it acts as a one-shot action', () => {
      const { scene } = buildTestSceneWithRow('Traces Instance Stats');

      scene.urlSync?.updateFromUrl({ srow: 'Traces-Instance-Stats' });

      expect(locationPartialSpy).toHaveBeenCalledWith({ srow: null });
    });

    it('expands all collapsed ancestor rows of a nested row', () => {
      const nestedRow = new RowItem({ title: 'Nested' });
      const middleRow = new RowItem({
        title: 'Middle',
        collapse: true,
        layout: new RowsLayoutManager({ rows: [nestedRow] }),
      });
      const outerRow = new RowItem({
        title: 'Outer',
        collapse: true,
        layout: new RowsLayoutManager({ rows: [middleRow] }),
      });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [outerRow] }),
      });

      scene.urlSync?.updateFromUrl({ srow: 'Outer/Middle/Nested' });

      expect(outerRow.state.collapse).toBe(false);
      expect(middleRow.state.collapse).toBe(false);
    });

    it('scrolls the correct row when a nested row shares its slug with a top-level row', () => {
      const nestedRow = new RowItem({ title: 'Row 1' });
      const containerRow = new RowItem({ title: 'Row 2', layout: new RowsLayoutManager({ rows: [nestedRow] }) });
      const topLevelRow = new RowItem({ title: 'Row 1' });
      const scene = new DashboardScene({
        title: 'hello',
        uid: 'dash-1',
        body: new RowsLayoutManager({ rows: [topLevelRow, containerRow] }),
      });

      const topLevelElement = document.createElement('div');
      document.body.appendChild(topLevelElement);
      topLevelRow.containerRef.current = topLevelElement;

      const nestedElement = document.createElement('div');
      document.body.appendChild(nestedElement);
      nestedRow.containerRef.current = nestedElement;

      scene.urlSync?.updateFromUrl({ srow: 'Row-2/Row-1' });
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(1);
      expect(scrollIntoViewSpy.mock.instances[0]).toBe(nestedElement);

      scene.urlSync?.updateFromUrl({ srow: 'Row-1' });
      expect(scrollIntoViewSpy).toHaveBeenCalledTimes(2);
      expect(scrollIntoViewSpy.mock.instances[1]).toBe(topLevelElement);
    });

    it('clears parameter but does not scroll when no row matches the slug', () => {
      const { scene } = buildTestSceneWithRow('Traces Instance Stats');

      scene.urlSync?.updateFromUrl({ srow: 'Does-Not-Exist' });

      expect(scrollIntoViewSpy).not.toHaveBeenCalled();
      expect(locationPartialSpy).toHaveBeenCalledWith({ srow: null });
    });
  });

  describe('entering edit mode', () => {
    it('it should be possible to go from the view panel view to the edit view when the dashboard is not in edit mdoe', () => {
      const scene = buildTestScene();
      scene.setState({ isEditing: false });
      scene.urlSync?.updateFromUrl({ viewPanel: 'panel-1' });
      expect(scene.state.viewPanel).toBeDefined();
      scene.urlSync?.updateFromUrl({ editPanel: 'panel-1' });
      expect(scene.state.editPanel).toBeDefined();
    });
  });
});

function buildTestSceneWithRow(title: string, { collapse }: { collapse?: boolean } = {}) {
  const row = new RowItem({ title, collapse });
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: new RowsLayoutManager({ rows: [row] }),
  });

  // simulate the row being rendered
  const element = document.createElement('div');
  document.body.appendChild(element);
  row.containerRef.current = element;

  return { scene, row, element };
}

function buildTestScene() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({
        title: 'Panel A',
        key: 'panel-1',
        pluginId: 'table',
        $data: new SceneQueryRunner({ key: 'data-query-runner', queries: [{ refId: 'A' }] }),
      }),

      new VizPanel({
        title: 'Panel B',
        key: 'panel-2',
        pluginId: 'table',
      }),
    ]),
  });

  return scene;
}
