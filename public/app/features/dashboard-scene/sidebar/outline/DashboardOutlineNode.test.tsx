import { SceneGridLayout, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { DashboardLinksSet } from '../../settings/links/DashboardLinksSet';
import { DashboardFiltersSet } from '../../settings/variables/DashboardFiltersSet';
import { SectionFiltersSet } from '../../settings/variables/SectionFiltersSet';
import { SidebarCategoryType } from '../types';

import { getOutlineSettingsTarget } from './DashboardOutlineNode';

function buildDashboard(state = {}) {
  return new DashboardScene({
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [] }) }),
    ...state,
  });
}

describe('getOutlineSettingsTarget', () => {
  describe('dashboard-level nodes', () => {
    it('maps the variable set to the dashboard variables category', () => {
      const dashboard = buildDashboard({ $variables: new SceneVariableSet({ variables: [] }) });

      expect(getOutlineSettingsTarget(dashboard.state.$variables!)?.categoryId).toBe(
        SidebarCategoryType.DashboardVariables
      );
      expect(getOutlineSettingsTarget(dashboard.state.$variables!)?.parent).toBe(dashboard);
    });

    it('maps the annotation data layer set to the dashboard annotations category', () => {
      const dashboard = buildDashboard({ $data: new DashboardDataLayerSet({ annotationLayers: [] }) });

      expect(getOutlineSettingsTarget(dashboard.state.$data as DashboardDataLayerSet)?.categoryId).toBe(
        SidebarCategoryType.DashboardAnnotations
      );
      expect(getOutlineSettingsTarget(dashboard.state.$data as DashboardDataLayerSet)?.parent).toBe(dashboard);
    });

    it('maps the links set to the dashboard links category', () => {
      const dashboard = buildDashboard();
      const linksSet = new DashboardLinksSet({ dashboardRef: dashboard.getRef() });

      expect(getOutlineSettingsTarget(linksSet)?.categoryId).toBe(SidebarCategoryType.DashboardLinks);
      expect(getOutlineSettingsTarget(linksSet)?.parent).toBe(dashboard);
    });

    it('maps the filters set to the dashboard filters category', () => {
      const dashboard = buildDashboard();
      const filtersSet = new DashboardFiltersSet({ dashboardRef: dashboard.getRef() });

      expect(getOutlineSettingsTarget(filtersSet)?.categoryId).toBe(SidebarCategoryType.DashboardFilters);
      expect(getOutlineSettingsTarget(filtersSet)?.parent).toBe(dashboard);
    });
  });

  describe('section-level nodes', () => {
    it('maps a row variable set to the row section variables category', () => {
      const row = new RowItem({
        $variables: new SceneVariableSet({ variables: [] }),
        layout: AutoGridLayoutManager.createEmpty(),
      });
      buildDashboard({ body: new RowsLayoutManager({ rows: [row] }) });

      expect(getOutlineSettingsTarget(row.state.$variables!)?.categoryId).toBe(SidebarCategoryType.RowSectionVariables);
      expect(getOutlineSettingsTarget(row.state.$variables!)?.parent).toBe(row);
    });

    it('maps a row filters set to the row section filters category', () => {
      const row = new RowItem({ layout: AutoGridLayoutManager.createEmpty() });
      const filtersSet = new SectionFiltersSet({ sectionRef: row.getRef() });

      expect(getOutlineSettingsTarget(filtersSet)?.categoryId).toBe(SidebarCategoryType.RowSectionFilters);
      expect(getOutlineSettingsTarget(filtersSet)?.parent).toBe(row);
    });

    it('maps a tab variable set to the tab section variables category', () => {
      const tab = new TabItem({
        $variables: new SceneVariableSet({ variables: [] }),
        layout: AutoGridLayoutManager.createEmpty(),
      });

      expect(getOutlineSettingsTarget(tab.state.$variables!)?.categoryId).toBe(SidebarCategoryType.TabSectionVariables);
      expect(getOutlineSettingsTarget(tab.state.$variables!)?.parent).toBe(tab);
    });

    it('maps a tab filters set to the tab section filters category', () => {
      const tab = new TabItem({ layout: AutoGridLayoutManager.createEmpty() });
      const filtersSet = new SectionFiltersSet({ sectionRef: tab.getRef() });

      expect(getOutlineSettingsTarget(filtersSet)?.categoryId).toBe(SidebarCategoryType.TabSectionFilters);
      expect(getOutlineSettingsTarget(filtersSet)?.parent).toBe(tab);
    });
  });

  describe('regular nodes', () => {
    it('returns undefined for nodes that should keep the default select behavior', () => {
      expect(getOutlineSettingsTarget(new VizPanel({}))).toBeUndefined();
      // A variable set with no recognized parent (e.g. not attached to a dashboard/row/tab)
      expect(getOutlineSettingsTarget(new SceneVariableSet({ variables: [] }))).toBeUndefined();
    });
  });
});
