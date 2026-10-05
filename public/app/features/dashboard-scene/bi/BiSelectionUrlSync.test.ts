import { locationService } from '@grafana/runtime';
import {
  type AdHocFilterWithLabels,
  AdHocFiltersVariable,
  LocalValueVariable,
  SceneVariableSet,
  SceneVariableValueChangedEvent,
  UrlSyncManager,
  VizPanel,
} from '@grafana/scenes';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { getCloneKey } from '../utils/clone';
import { getPanelSourceIdentity } from '../utils/getPanelSourceIdentity';

import { BI_SELECTION_URL_KEY, type BiSelectionUrlSync } from './BiSelectionUrlSync';
import { getValidBiSelection, releaseBiSelectionStamp } from './biSelectionStamp';

const stampedBy = (sourcePanel: string, key: string, value: string): AdHocFilterWithLabels => ({
  key,
  operator: '=',
  value,
  meta: { biSelection: { sourcePanel, key, values: [value] } },
});

function buildScene() {
  const variable = new AdHocFiltersVariable({ name: 'Filters', datasource: { uid: 'ds-1' }, filters: [] });
  const logs = new AdHocFiltersVariable({ name: 'Logs', datasource: { uid: 'ds-2' }, filters: [] });
  const scene = new DashboardScene({
    uid: 'dash-1',
    title: 'hello',
    $variables: new SceneVariableSet({ variables: [variable, logs] }),
    body: DefaultGridLayoutManager.fromVizPanels([
      new VizPanel({ key: 'panel-1', pluginId: 'barchart' }),
      new VizPanel({ key: 'panel-2', pluginId: 'barchart' }),
    ]),
  });

  return { scene, variable, logs, urlSync: scene.state.biSelectionUrlSync! };
}

const owners = (variable: AdHocFiltersVariable) =>
  variable.state.filters.map((filter) => getValidBiSelection(filter)?.sourcePanel);

const urlOwners = (urlSync: BiSelectionUrlSync) => urlSync.getUrlState()[BI_SELECTION_URL_KEY];

// Like a URL sync pass: the URL changes first, then the variable's URL handler applies it.
function setFiltersFromUrl(variable: AdHocFiltersVariable, filters: string[]) {
  const key = `var-${variable.state.name}`;
  const params = new URLSearchParams(locationService.getLocation().search);
  params.delete(key);
  filters.forEach((filter) => params.append(key, filter));
  locationService.replace({ search: params.toString() });
  variable.urlSync!.updateFromUrl({ [key]: filters });
}

function setOwnersFromUrl(urlSync: BiSelectionUrlSync, values: string[] | null) {
  urlSync.urlSync!.updateFromUrl({ [BI_SELECTION_URL_KEY]: values });
}

describe('BiSelectionUrlSync', () => {
  afterEach(() => {
    setTestFlags({});
    locationService.replace({ search: '' });
  });

  it('is not created while BI mode is off, leaving the dashboard URL state as without the feature', () => {
    const off = buildScene();
    off.variable.setState({ filters: [stampedBy('panel-1', 'country', 'UK')] });
    setTestFlags({ 'dashboard.biMode': true });
    const on = buildScene();
    on.variable.setState({ filters: [stampedBy('panel-1', 'country', 'UK')] });
    on.scene.setState({ biSelectionUrlSync: undefined });

    expect(off.scene.state.biSelectionUrlSync).toBeUndefined();
    expect(new UrlSyncManager().getUrlState(off.scene)).toStrictEqual(new UrlSyncManager().getUrlState(on.scene));
  });

  describe('with BI mode on', () => {
    beforeEach(() => {
      setTestFlags({ 'dashboard.biMode': true });
    });

    it('writes variable, key and owner per selection, escaping pipes, and keeps the URL current', () => {
      const { variable, logs, urlSync } = buildScene();
      const deactivate = urlSync.activate();

      variable.updateFilters([stampedBy('panel-1', 'country', 'UK'), { key: 'region', operator: '=', value: 'EU' }]);
      logs.updateFilters([stampedBy('panel-2', 'a|b', 'x')]);
      expect(urlOwners(urlSync)).toEqual(['Filters|country|panel-1', 'Logs|a__gfp__b|panel-2']);

      variable.updateFilters([stampedBy('panel-2', 'country', 'UK')]);
      expect(urlOwners(urlSync)).toEqual(['Filters|country|panel-2', 'Logs|a__gfp__b|panel-2']);

      deactivate();
      variable.updateFilters([]);
      expect(urlOwners(urlSync)).toEqual(['Filters|country|panel-2', 'Logs|a__gfp__b|panel-2']);
    });

    it('ends a selection whose filter is removed, edited or released', () => {
      const { variable, urlSync } = buildScene();
      const deactivate = urlSync.activate();
      const selected = (key: string) => stampedBy('panel-1', key, 'UK');

      variable.updateFilters([selected('a'), selected('b'), selected('c')]);
      expect(urlOwners(urlSync)).toHaveLength(3);

      // Edit a's value, release b, remove c
      const [a, b] = variable.state.filters;
      variable.updateFilters([{ ...a, value: 'FR' }, releaseBiSelectionStamp(b)]);

      expect(urlOwners(urlSync)).toEqual([]);
      deactivate();
    });

    it('restores when the Filters variable applies the URL after this object', () => {
      const { variable, urlSync } = buildScene();

      setOwnersFromUrl(urlSync, ['Filters|country|panel-1', 'Filters|a__gfp__b|panel-2']);
      setFiltersFromUrl(variable, ['country|=|UK', 'a__gfp__b|=|FR', 'region|=|EU']);
      const deactivate = urlSync.activate();

      expect(owners(variable)).toEqual(['panel-1', 'panel-2', undefined]);
      expect(urlOwners(urlSync)).toEqual(['Filters|country|panel-1', 'Filters|a__gfp__b|panel-2']);
      deactivate();
    });

    it('restores when the Filters variable applied the URL first, and publishes the change', () => {
      const { variable, urlSync } = buildScene();
      setFiltersFromUrl(variable, ['country|=|UK']);
      const onValueChanged = jest.fn();
      variable.subscribeToEvent(SceneVariableValueChangedEvent, onValueChanged);

      setOwnersFromUrl(urlSync, ['Filters|country|panel-1']);

      expect(owners(variable)).toEqual(['panel-1']);
      expect(onValueChanged).toHaveBeenCalledTimes(1);
    });

    it('restores the same key in two variables to their own owners', () => {
      const { variable, logs, urlSync } = buildScene();
      setFiltersFromUrl(variable, ['country|=|UK']);
      setFiltersFromUrl(logs, ['country|=|FR']);

      setOwnersFromUrl(urlSync, ['Filters|country|panel-1', 'Logs|country|panel-2']);

      expect(owners(variable)).toEqual(['panel-1']);
      expect(owners(logs)).toEqual(['panel-2']);
    });

    it('does not stamp !=, read-only or missing-key filters, and drops an owner whose key is gone', () => {
      const { variable, urlSync } = buildScene();
      variable.setState({
        filters: [
          { key: 'country', operator: '!=', value: 'UK' },
          { key: 'country', operator: '=', value: 'FR', readOnly: true },
        ],
      });

      setOwnersFromUrl(urlSync, ['Filters|country|panel-1', 'Filters|missing|panel-1']);
      const deactivate = urlSync.activate();

      expect(variable.state.filters.map((filter) => filter.meta)).toEqual([undefined, undefined]);
      expect(urlOwners(urlSync)).toEqual([]);
      deactivate();
    });

    it('keeps an owner whose panel does not exist yet and stamps it when a delayed repeat adds the panel', () => {
      const { scene, variable, urlSync } = buildScene();
      const makeClone = () =>
        new VizPanel({
          key: getCloneKey('panel-2', 1),
          repeatSourceKey: 'panel-2',
          pluginId: 'barchart',
          $variables: new SceneVariableSet({ variables: [new LocalValueVariable({ name: 'country', value: 'FR' })] }),
        });
      const cloneIdentity = getPanelSourceIdentity(makeClone());

      setFiltersFromUrl(variable, ['country|=|UK']);
      setOwnersFromUrl(urlSync, [`Filters|country|${cloneIdentity}`]);
      const deactivate = urlSync.activate();

      expect(owners(variable)).toEqual([undefined]);
      expect(urlOwners(urlSync)).toEqual([`Filters|country|${cloneIdentity}`]);

      findGridItem(scene, 'panel-2').setState({ repeatedPanels: [makeClone()] });

      expect(owners(variable)).toEqual([cloneIdentity]);
      deactivate();
    });

    it('does nothing more once deactivated straight after reading the URL', () => {
      const { variable, urlSync } = buildScene();
      const deactivate = urlSync.activate();

      setOwnersFromUrl(urlSync, ['Filters|country|panel-1']);
      deactivate();
      setFiltersFromUrl(variable, ['country|=|UK']);

      expect(owners(variable)).toEqual([undefined]);
    });

    it('ends a selection when its pill is removed next to an ordinary filter on the same key', () => {
      const { variable, urlSync } = buildScene();
      const deactivate = urlSync.activate();
      const manual: AdHocFilterWithLabels = { key: 'country', operator: '=', value: 'FR' };
      variable.updateFilters([stampedBy('panel-1', 'country', 'UK'), manual]);
      expect(urlOwners(urlSync)).toEqual(['Filters|country|panel-1']);

      variable._removeFilter(variable.state.filters[0]);

      expect(variable.state.filters).toEqual([manual]);
      expect(urlOwners(urlSync)).toEqual([]);
      deactivate();
    });

    it('round-trips a dashboard and a section variable that share a name', () => {
      const build = () => {
        const dashboardFilters = new AdHocFiltersVariable({
          name: 'Filters',
          datasource: { uid: 'ds-1' },
          filters: [],
        });
        const sectionFilters = new AdHocFiltersVariable({ name: 'Filters', datasource: { uid: 'ds-2' }, filters: [] });
        const row = (panelKey: string, variables?: AdHocFiltersVariable[]) =>
          new RowItem({
            $variables: variables && new SceneVariableSet({ variables }),
            layout: new AutoGridLayoutManager({
              layout: new AutoGridLayout({
                children: [new AutoGridItem({ body: new VizPanel({ key: panelKey, pluginId: 'barchart' }) })],
              }),
            }),
          });
        const scene = new DashboardScene({
          uid: 'dash-1',
          title: 'hello',
          $variables: new SceneVariableSet({ variables: [dashboardFilters] }),
          body: new RowsLayoutManager({ rows: [row('panel-1'), row('panel-2', [sectionFilters])] }),
        });
        return { scene, dashboardFilters, sectionFilters, urlSync: scene.state.biSelectionUrlSync! };
      };
      const sync = (built: ReturnType<typeof build>) => {
        const urlSyncManager = new UrlSyncManager();
        urlSyncManager.initSync(built.scene);
        const deactivate = built.urlSync.activate();
        return () => {
          deactivate();
          urlSyncManager.cleanUp(built.scene);
        };
      };

      const written = build();
      const stopWritten = sync(written);
      written.dashboardFilters.updateFilters([stampedBy('panel-1', 'country', 'UK')]);
      written.sectionFilters.updateFilters([stampedBy('panel-2', 'country', 'FR')]);
      stopWritten();

      const params = new URLSearchParams(locationService.getLocation().search);
      expect(params.getAll(BI_SELECTION_URL_KEY)).toEqual(['Filters|country|panel-1', 'Filters-2|country|panel-2']);
      expect(params.get('var-Filters')).toBe('country|=|UK');
      expect(params.get('var-Filters-2')).toBe('country|=|FR');

      // A shared link: a fresh scene restored from the same URL
      const restored = build();
      const stopRestored = sync(restored);

      expect(owners(restored.dashboardFilters)).toEqual(['panel-1']);
      expect(owners(restored.sectionFilters)).toEqual(['panel-2']);
      stopRestored();
    });

    it.each([
      ['value', { value: 'FR' }, { value: 'UK' }],
      ['key', { key: 'region' }, { key: 'country' }],
    ])('does not resurrect a selection when its %s is edited and edited back', (_, edit, revert) => {
      const { variable, urlSync } = buildScene();
      const deactivate = urlSync.activate();
      variable.updateFilters([stampedBy('panel-1', 'country', 'UK')]);

      variable._updateFilter(variable.state.filters[0], edit);
      variable._updateFilter(variable.state.filters[0], revert);

      expect(variable.state.filters[0]).toMatchObject({ key: 'country', value: 'UK', meta: { biSelection: null } });
      expect(owners(variable)).toEqual([undefined]);
      expect(urlOwners(urlSync)).toEqual([]);
      deactivate();
    });

    it('ends a pending owner when the Filters Overview edits its filter before the panel appears', () => {
      const { scene, variable, urlSync } = buildScene();
      const cloneIdentity = getPanelSourceIdentity(makeRepeatClone());
      setFiltersFromUrl(variable, ['country|=|UK']);
      setOwnersFromUrl(urlSync, [`Filters|country|${cloneIdentity}`]);
      const deactivate = urlSync.activate();

      // The same state write as useFiltersOverviewState's apply: fresh filters and origin filters together
      variable.setState({
        filters: [{ key: 'country', operator: '=', value: 'FR' }],
        originFilters: variable.validateOriginFilters([]),
      });
      findGridItem(scene, 'panel-2').setState({ repeatedPanels: [makeRepeatClone()] });

      expect(owners(variable)).toEqual([undefined]);
      expect(urlOwners(urlSync)).toEqual([]);
      deactivate();
    });

    it('ends a pending owner when its filter is edited locally before the panel appears', () => {
      const { scene, variable, urlSync } = buildScene();
      const cloneIdentity = getPanelSourceIdentity(makeRepeatClone());
      setFiltersFromUrl(variable, ['country|=|UK']);
      setOwnersFromUrl(urlSync, [`Filters|country|${cloneIdentity}`]);
      const deactivate = urlSync.activate();

      variable._updateFilter(variable.state.filters[0], { value: 'FR' });
      findGridItem(scene, 'panel-2').setState({ repeatedPanels: [makeRepeatClone()] });

      expect(owners(variable)).toEqual([undefined]);
      expect(urlOwners(urlSync)).toEqual([]);
      deactivate();
    });

    describe('through the URL sync manager', () => {
      const filtersParam = (value: string) => `var-Filters=${encodeURIComponent(`country|=|${value}`)}`;
      const ownerParam = (panel: string) => `${BI_SELECTION_URL_KEY}=${encodeURIComponent(`Filters|country|${panel}`)}`;

      it('restores a shared URL and keeps ownership when navigation changes only the filter values', () => {
        locationService.replace({ search: `${filtersParam('UK')}&${ownerParam('panel-1')}` });
        const { scene, variable, urlSync } = buildScene();
        const urlSyncManager = new UrlSyncManager();
        urlSyncManager.initSync(scene);
        const deactivate = urlSync.activate();

        expect(owners(variable)).toEqual(['panel-1']);

        locationService.push({ search: `${filtersParam('FR')}&${ownerParam('panel-1')}` });
        urlSyncManager.handleNewLocation(locationService.getLocation());

        expect(variable.state.filters[0].value).toBe('FR');
        expect(owners(variable)).toEqual(['panel-1']);
        expect(locationService.getSearchObject()[BI_SELECTION_URL_KEY]).toBe('Filters|country|panel-1');

        locationService.push({ search: `${filtersParam('DE')}&${ownerParam('panel-2')}` });
        urlSyncManager.handleNewLocation(locationService.getLocation());
        expect(owners(variable)).toEqual(['panel-2']);

        locationService.getHistory().goBack();
        urlSyncManager.handleNewLocation(locationService.getLocation());
        expect(variable.state.filters[0].value).toBe('FR');
        expect(owners(variable)).toEqual(['panel-1']);

        locationService.push({ search: filtersParam('FR') });
        urlSyncManager.handleNewLocation(locationService.getLocation());
        expect(owners(variable)).toEqual([undefined]);

        deactivate();
        urlSyncManager.cleanUp(scene);
      });

      it('retries an owner navigated to on an active scene once a delayed repeat adds its panel', () => {
        // Only biSelection changes in the navigation, so the Filters variable does not trigger a reconcile.
        locationService.replace({ search: filtersParam('UK') });
        const { scene, variable, urlSync } = buildScene();
        const urlSyncManager = new UrlSyncManager();
        urlSyncManager.initSync(scene);
        const deactivate = urlSync.activate();
        const makeClone = () =>
          new VizPanel({
            key: getCloneKey('panel-2', 1),
            repeatSourceKey: 'panel-2',
            pluginId: 'barchart',
            $variables: new SceneVariableSet({ variables: [new LocalValueVariable({ name: 'country', value: 'FR' })] }),
          });
        const cloneIdentity = getPanelSourceIdentity(makeClone());

        locationService.push({ search: `${filtersParam('UK')}&${ownerParam(cloneIdentity)}` });
        urlSyncManager.handleNewLocation(locationService.getLocation());

        expect(owners(variable)).toEqual([undefined]);
        expect(locationService.getSearchObject()[BI_SELECTION_URL_KEY]).toBe(`Filters|country|${cloneIdentity}`);

        findGridItem(scene, 'panel-2').setState({ repeatedPanels: [makeClone()] });

        expect(owners(variable)).toEqual([cloneIdentity]);
        deactivate();
        urlSyncManager.cleanUp(scene);
      });
    });
  });
});

function findGridItem(scene: DashboardScene, panelKey: string): DashboardGridItem {
  const parent = scene.state.body.getVizPanels().find((p) => p.state.key === panelKey)?.parent;
  if (!(parent instanceof DashboardGridItem)) {
    throw new Error(`no grid item for ${panelKey}`);
  }
  return parent;
}

function makeRepeatClone() {
  return new VizPanel({
    key: getCloneKey('panel-2', 1),
    repeatSourceKey: 'panel-2',
    pluginId: 'barchart',
    $variables: new SceneVariableSet({ variables: [new LocalValueVariable({ name: 'country', value: 'FR' })] }),
  });
}
