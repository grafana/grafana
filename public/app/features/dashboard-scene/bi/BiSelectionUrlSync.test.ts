import { locationService } from '@grafana/runtime';
import {
  type AdHocFilterWithLabels,
  AdHocFiltersVariable,
  SceneVariableSet,
  SceneVariableValueChangedEvent,
  UrlSyncManager,
  VizPanel,
} from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { BI_SELECTION_URL_KEY, type BiSelectionUrlSync } from './BiSelectionUrlSync';
import { getValidBiSelection } from './biSelectionStamp';

const stampedBy = (sourcePanel: string, key: string, value: string): AdHocFilterWithLabels => ({
  key,
  operator: '=',
  value,
  meta: { biSelection: { sourcePanel, key, values: [value] } },
});

function buildScene() {
  const variable = new AdHocFiltersVariable({ name: 'Filters', datasource: { uid: 'ds-1' }, filters: [] });
  const scene = new DashboardScene({
    uid: 'dash-1',
    title: 'hello',
    $variables: new SceneVariableSet({ variables: [variable] }),
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({ key: 'panel-1', pluginId: 'barchart' }),
      new VizPanel({ key: 'panel-2', pluginId: 'barchart' }),
    ]),
  });

  return { scene, variable, urlSync: scene.state.biSelectionUrlSync! };
}

const owners = (variable: AdHocFiltersVariable) =>
  variable.state.filters.map((filter) => getValidBiSelection(filter)?.sourcePanel);

const settle = () => Promise.resolve();

function setFiltersFromUrl(variable: AdHocFiltersVariable, filters: string[]) {
  variable.urlSync!.updateFromUrl({ 'var-Filters': filters });
}

function setOwnersFromUrl(urlSync: BiSelectionUrlSync, values: string[]) {
  urlSync.urlSync!.updateFromUrl({ [BI_SELECTION_URL_KEY]: values });
}

describe('BiSelectionUrlSync', () => {
  afterEach(() => {
    setTestFlags({});
    locationService.replace({ search: '' });
  });

  it('is not created and writes nothing to the URL while BI mode is off', () => {
    const { scene, variable } = buildScene();
    variable.setState({ filters: [stampedBy('panel-1', 'country', 'UK')] });

    expect(scene.state.biSelectionUrlSync).toBeUndefined();
    expect(new UrlSyncManager().getUrlState(scene)).not.toHaveProperty(BI_SELECTION_URL_KEY);
  });

  describe('with BI mode on', () => {
    beforeEach(() => {
      setTestFlags({ 'dashboard.biMode': true });
    });

    it('writes one owner and key per selection, escaping pipes, and keeps the URL current', () => {
      const { variable, urlSync } = buildScene();
      const deactivate = urlSync.activate();

      variable.updateFilters([stampedBy('panel-1', 'country', 'UK'), { key: 'region', operator: '=', value: 'EU' }]);
      expect(urlSync.getUrlState()).toEqual({ [BI_SELECTION_URL_KEY]: ['country|panel-1'] });

      variable.updateFilters([stampedBy('panel-2', 'a|b', 'UK')]);
      expect(urlSync.getUrlState()).toEqual({ [BI_SELECTION_URL_KEY]: ['a__gfp__b|panel-2'] });

      variable.updateFilters([]);
      expect(urlSync.getUrlState()).toEqual({ [BI_SELECTION_URL_KEY]: [] });

      deactivate();
      variable.updateFilters([stampedBy('panel-1', 'country', 'UK')]);
      expect(urlSync.getUrlState()).toEqual({ [BI_SELECTION_URL_KEY]: [] });
    });

    it('re-stamps when the Filters variable applies the URL after this object', async () => {
      const { variable, urlSync } = buildScene();

      setOwnersFromUrl(urlSync, ['country|panel-1', 'a__gfp__b|panel-2']);
      setFiltersFromUrl(variable, ['country|=|UK', 'a__gfp__b|=|FR', 'region|=|EU']);
      await settle();

      expect(owners(variable)).toEqual(['panel-1', 'panel-2', undefined]);
      expect(urlSync.getUrlState()).toEqual({ [BI_SELECTION_URL_KEY]: ['country|panel-1', 'a__gfp__b|panel-2'] });
    });

    it('re-stamps when the Filters variable applied the URL first, and publishes the change', async () => {
      const { variable, urlSync } = buildScene();
      setFiltersFromUrl(variable, ['country|=|UK']);
      const onValueChanged = jest.fn();
      variable.subscribeToEvent(SceneVariableValueChangedEvent, onValueChanged);

      setOwnersFromUrl(urlSync, ['country|panel-1']);
      await settle();

      expect(owners(variable)).toEqual(['panel-1']);
      expect(onValueChanged).toHaveBeenCalledTimes(1);
    });

    it('leaves filters ordinary when the owner panel or key does not exist, and drops them from the URL', async () => {
      const { variable, urlSync } = buildScene();

      setOwnersFromUrl(urlSync, ['country|panel-9', 'missing|panel-1']);
      setFiltersFromUrl(variable, ['country|=|UK']);
      await settle();

      expect(owners(variable)).toEqual([undefined]);
      expect(urlSync.getUrlState()).toEqual({ [BI_SELECTION_URL_KEY]: [] });

      // Once settled, later filter changes are not stamped from the old URL value.
      variable.updateFilters([...variable.state.filters, { key: 'missing', operator: '=', value: 'x' }]);
      expect(owners(variable)).toEqual([undefined, undefined]);
    });

    it('does not stamp !=, injected or read-only filters', async () => {
      const { variable, urlSync } = buildScene();
      variable.setState({
        filters: [
          { key: 'country', operator: '!=', value: 'UK' },
          { key: 'country', operator: '=', value: 'FR', readOnly: true },
        ],
      });

      setOwnersFromUrl(urlSync, ['country|panel-1']);
      await settle();

      expect(variable.state.filters.map((filter) => filter.meta)).toEqual([undefined, undefined]);
    });

    it('follows back/forward: re-stamps with the new owners and clears stale stamps', async () => {
      const { variable, urlSync } = buildScene();
      const deactivate = urlSync.activate();
      variable.setState({ filters: [stampedBy('panel-1', 'country', 'UK'), stampedBy('panel-1', 'region', 'EU')] });

      setOwnersFromUrl(urlSync, ['country|panel-2']);
      await settle();

      expect(owners(variable)).toEqual(['panel-2', undefined]);
      expect(urlSync.getUrlState()).toEqual({ [BI_SELECTION_URL_KEY]: ['country|panel-2'] });

      urlSync.urlSync!.updateFromUrl({ [BI_SELECTION_URL_KEY]: null });
      await settle();

      expect(owners(variable)).toEqual([undefined, undefined]);
      deactivate();
    });

    it('restores the selection from a shared URL through the URL sync manager', async () => {
      locationService.replace({ search: 'var-Filters=country%7C%3D%7CUK&biSelection=country%7Cpanel-1' });
      const { scene, variable } = buildScene();
      const urlSyncManager = new UrlSyncManager();

      urlSyncManager.initSync(scene);
      await settle();

      expect(owners(variable)).toEqual(['panel-1']);
      expect(locationService.getSearchObject()[BI_SELECTION_URL_KEY]).toBe('country|panel-1');
      urlSyncManager.cleanUp(scene);
    });
  });
});
