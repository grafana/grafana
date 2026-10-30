import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SceneGridLayout, SceneVariableSet, VizPanel } from '@grafana/scenes';

import { DashboardDataLayerSet } from '../../scene/DashboardDataLayerSet';
import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { DashboardLinksSet } from '../../settings/links/DashboardLinksSet';
import { DashboardFiltersSet } from '../../settings/variables/DashboardFiltersSet';
import { SectionFiltersSet } from '../../settings/variables/SectionFiltersSet';
import { SidebarCategoryType } from '../types';

import { DashboardOutline } from './DashboardOutline';
import { DashboardOutlineNode, getOutlineSettingsTarget } from './DashboardOutlineNode';

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

describe('panel navigation', () => {
  it.each([
    { name: 'auto-grid', Item: AutoGridItem },
    { name: 'custom-grid', Item: DashboardGridItem },
  ])('scrolls to and highlights a $name panel on every outline click', async ({ Item }) => {
    const user = userEvent.setup();
    const panel = new VizPanel({ key: 'panel-1', title: 'Requests' });
    const item = new Item({ key: 'grid-item-1', body: panel });
    const dashboard = buildDashboard();
    const element = document.createElement('div');
    const cancel = jest.fn();
    element.animate = jest.fn().mockReturnValue({ cancel });
    element.scrollIntoView = jest.fn();
    element.dataset.griditemKey = 'grid-item-1';
    item.containerRef.current = element;
    document.body.appendChild(element);

    try {
      render(
        <DashboardOutlineNode
          sceneObject={panel}
          sidebar={dashboard.state.sidebar}
          outline={new DashboardOutline()}
          isEditing={false}
          depth={1}
          index={0}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Requests' }));
      expect(element.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center', inline: 'center' });
      expect(element.animate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ outline: '1px solid #3d71d9' })]),
        { duration: 2400 }
      );

      await user.click(screen.getByRole('button', { name: 'Requests' }));
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(element.animate).toHaveBeenCalledTimes(2);
    } finally {
      element.remove();
    }
  });
});
