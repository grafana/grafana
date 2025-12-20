import { config, locationService } from '@grafana/runtime';
import { CustomVariable, SceneTimeRange, TextBoxVariable, sceneGraph } from '@grafana/scenes';

jest.mock('../pages/DashboardScenePageStateManager', () => ({
  getDashboardScenePageStateManager: jest.fn(),
}));

jest.mock('../utils/dashboardSceneGraph', () => ({
  dashboardSceneGraph: {
    getVizPanels: jest.fn(() => []),
  },
}));

jest.mock('../utils/utils', () => ({
  getPanelIdForVizPanel: jest.fn(),
  getQueryRunnerFor: jest.fn(),
}));

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';

import { dashboardSceneJsonApiV2 } from './runtimeDashboardSceneJsonApiV2';

describe('dashboardSceneJsonApiV2 (navigation/variables/time)', () => {
  beforeEach(() => {
    jest.restoreAllMocks();

    // Enable v2 API gate for tests.
    config.featureToggles.kubernetesDashboards = true;
    config.featureToggles.kubernetesDashboardsV2 = true;

    jest.spyOn(locationService, 'partial').mockImplementation(() => {});
  });

  it('getCurrentDashboardVariables returns a stable JSON shape and applyCurrentDashboardVariables updates values', () => {
    const customVar = new CustomVariable({ name: 'customVar', query: 'a,b,c', value: 'a', text: 'a' });
    const textVar = new TextBoxVariable({ type: 'textbox', name: 'tb', value: 'x' });

    const dashboard = {
      state: {
        $variables: { state: { variables: [customVar, textVar] } },
      },
      publishEvent: jest.fn(),
    };

    (getDashboardScenePageStateManager as jest.Mock).mockReturnValue({ state: { dashboard } });

    const before = JSON.parse(dashboardSceneJsonApiV2.getCurrentDashboardVariables(0));
    expect(before.variables).toEqual(
      expect.arrayContaining([
        { name: 'customVar', value: 'a' },
        { name: 'tb', value: 'x' },
      ])
    );

    dashboardSceneJsonApiV2.applyCurrentDashboardVariables(JSON.stringify({ customVar: ['b', 'c'], tb: 'y' }));

    expect(customVar.getValue()).toEqual(['b', 'c']);
    expect(textVar.getValue()).toBe('y');
    expect(locationService.partial).toHaveBeenCalledWith({ 'var-customVar': ['b', 'c'] }, true);
    expect(locationService.partial).toHaveBeenCalledWith({ 'var-tb': 'y' }, true);
  });

  it('getCurrentDashboardTimeRange returns raw values and applyCurrentDashboardTimeRange calls SceneTimeRange APIs', () => {
    const tr = new SceneTimeRange({ from: 'now-1h', to: 'now', timeZone: 'browser' });
    const tzSpy = jest.spyOn(tr, 'onTimeZoneChange');
    const trSpy = jest.spyOn(tr, 'onTimeRangeChange');
    const refreshSpy = jest.spyOn(tr, 'onRefresh');

    jest.spyOn(sceneGraph, 'getTimeRange').mockReturnValue(tr);

    const dashboard = { state: {}, publishEvent: jest.fn() };
    (getDashboardScenePageStateManager as jest.Mock).mockReturnValue({ state: { dashboard } });

    const current = JSON.parse(dashboardSceneJsonApiV2.getCurrentDashboardTimeRange(0));
    expect(current).toEqual({ from: 'now-1h', to: 'now', timezone: 'browser' });

    dashboardSceneJsonApiV2.applyCurrentDashboardTimeRange(JSON.stringify({ from: 'now-6h', to: 'now', timezone: 'utc' }));
    expect(tzSpy).toHaveBeenCalledWith('utc');
    expect(trSpy).toHaveBeenCalled();
    expect(refreshSpy).toHaveBeenCalled();
  });

  it('selectCurrentDashboardTab selects a matching tab by title', () => {
    const tabA = new TabItem({ key: 'tab-a', title: 'A' });
    const tabB = new TabItem({ key: 'tab-b', title: 'B' });
    const tabs = new TabsLayoutManager({ tabs: [tabA, tabB] });

    const dashboard = {
      state: { body: tabs },
      publishEvent: jest.fn(),
    };
    (getDashboardScenePageStateManager as jest.Mock).mockReturnValue({ state: { dashboard } });

    const spy = jest.spyOn(tabs, 'switchToTab');
    dashboardSceneJsonApiV2.selectCurrentDashboardTab(JSON.stringify({ title: 'B' }));

    expect(spy).toHaveBeenCalledWith(tabB);
  });

  it('getCurrentDashboardNavigation returns the active tab', () => {
    const tabA = new TabItem({ key: 'tab-a', title: 'Overview' });
    const tabB = new TabItem({ key: 'tab-b', title: 'Explore' });
    const tabs = new TabsLayoutManager({ tabs: [tabA, tabB], currentTabSlug: tabB.getSlug() });

    const dashboard = {
      state: { body: tabs },
      publishEvent: jest.fn(),
    };
    (getDashboardScenePageStateManager as jest.Mock).mockReturnValue({ state: { dashboard } });

    const nav = JSON.parse(dashboardSceneJsonApiV2.getCurrentDashboardNavigation(0));
    expect(nav).toEqual({ tab: { slug: tabB.getSlug(), title: 'Explore' } });
  });

  it('focusCurrentDashboardRow expands a collapsed row and calls scrollIntoView', () => {
    const row = new RowItem({ title: 'request duration', collapse: true });
    const scrollSpy = jest.spyOn(row, 'scrollIntoView').mockImplementation(() => {});

    jest.spyOn(sceneGraph, 'findAllObjects').mockReturnValue([row]);

    const dashboard = { state: {}, publishEvent: jest.fn() };
    (getDashboardScenePageStateManager as jest.Mock).mockReturnValue({ state: { dashboard } });

    dashboardSceneJsonApiV2.focusCurrentDashboardRow(JSON.stringify({ title: 'request duration' }));

    expect(row.getCollapsedState()).toBe(false);
    expect(scrollSpy).toHaveBeenCalled();
  });
});


