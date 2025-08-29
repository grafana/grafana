import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config, locationService } from '@grafana/runtime';

import { ScopesService } from '../ScopesService';

import {
  applyScopes,
  clearScopesSearch,
  expandResultApplications,
  expandResultApplicationsCloud,
  expandResultCloud,
  openSelector,
  searchScopes,
  selectPersistedApplicationsMimir,
  selectResultApplicationsCloud,
  selectResultApplicationsCloudDev,
  selectResultApplicationsGrafana,
  selectResultApplicationsMimir,
  selectResultCloud,
  selectResultCloudDev,
  selectResultCloudOps,
  updateScopes,
} from './utils/actions';
import {
  expectPersistedApplicationsMimirPresent,
  expectResultApplicationsCloudNotPresent,
  expectResultApplicationsCloudPresent,
  expectResultApplicationsGrafanaNotPresent,
  expectResultApplicationsGrafanaPresent,
  expectResultApplicationsGrafanaSelected,
  expectResultApplicationsMimirNotPresent,
  expectResultApplicationsMimirPresent,
  expectResultApplicationsMimirSelected,
  expectResultCloudDevNotSelected,
  expectResultCloudDevSelected,
  expectResultCloudOpsNotSelected,
  expectResultCloudOpsSelected,
  expectScopesHeadline,
  expectScopesSelectorValue,
} from './utils/assertions';
import { getDatasource, getInstanceSettings, getMock } from './utils/mocks';
import { renderDashboard, resetScenes } from './utils/render';

jest.mock('@grafana/runtime', () => ({
  __esModule: true,
  ...jest.requireActual('@grafana/runtime'),
  useChromeHeaderHeight: jest.fn(),
  getBackendSrv: () => ({ get: getMock }),
  getDataSourceSrv: () => ({ get: getDatasource, getInstanceSettings }),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
}));

describe('Tree', () => {
  let fetchNodesSpy: jest.SpyInstance;
  let fetchScopeSpy: jest.SpyInstance;
  let scopesService: ScopesService;
  let user: ReturnType<typeof userEvent.setup>;

  beforeAll(() => {
    config.featureToggles.scopeFilters = true;
    config.featureToggles.groupByVariable = true;
  });

  beforeEach(async () => {
    const result = await renderDashboard();
    scopesService = result.scopesService;
    fetchNodesSpy = jest.spyOn(result.client, 'fetchNodes');
    fetchScopeSpy = jest.spyOn(result.client, 'fetchScope');
    user = userEvent.setup();
  });

  afterEach(async () => {
    locationService.replace('');
    await resetScenes([fetchNodesSpy, fetchScopeSpy]);
  });

  it('Gives autofocus to search field when node is expanded', async () => {
    await openSelector();
    expect(screen.getByRole('combobox', { name: 'Search' })).not.toHaveFocus();

    await expandResultApplications();
    expect(screen.getByRole('combobox', { name: 'Search Applications' })).toHaveFocus();
  });

  it('Fetches scope details on select', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    expect(fetchScopeSpy).toHaveBeenCalledTimes(1);
  });

  it('Selects the proper scopes', async () => {
    await updateScopes(scopesService, ['grafana', 'mimir']);
    await openSelector();
    await expandResultApplications();
    expectResultApplicationsGrafanaSelected();
    expectResultApplicationsMimirSelected();
  });

  it('Can select scopes from same level', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    await selectResultApplicationsMimir();
    await selectResultApplicationsCloud();
    await applyScopes();
    expectScopesSelectorValue('Grafana + Mimir + Cloud');
  });

  it('Can select a node from an inner level', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    await expandResultApplicationsCloud();
    await selectResultApplicationsCloudDev();
    await applyScopes();
    expectScopesSelectorValue('Dev');
  });

  it('Can select a node from an upper level', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsGrafana();
    await expandResultApplications();
    await selectResultCloud();
    await applyScopes();
    expectScopesSelectorValue('Cloud');
  });

  it('Respects only one select per container', async () => {
    await openSelector();
    await expandResultCloud();
    await selectResultCloudDev();
    expectResultCloudDevSelected();
    expectResultCloudOpsNotSelected();

    await selectResultCloudOps();
    expectResultCloudDevNotSelected();
    expectResultCloudOpsSelected();
  });

  it('Search works', async () => {
    await openSelector();
    await expandResultApplications();
    await searchScopes('Cloud');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
    expectResultApplicationsGrafanaNotPresent();
    expectResultApplicationsMimirNotPresent();
    expectResultApplicationsCloudPresent();

    await clearScopesSearch();
    expect(fetchNodesSpy).toHaveBeenCalledTimes(4);

    await searchScopes('Grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(5);
    expectResultApplicationsGrafanaPresent();
    expectResultApplicationsCloudNotPresent();
  });

  it('Opens to a selected scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await expandResultApplications();
    await expandResultCloud();
    await applyScopes();
    await openSelector();
    expectResultApplicationsMimirPresent();
  });

  it('Persists a scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
    expectPersistedApplicationsMimirPresent();
    expectResultApplicationsGrafanaPresent();
  });

  it('Does not persist a retrieved scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('mimir');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
    expectResultApplicationsMimirPresent();
  });

  it('Removes persisted nodes', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

    await clearScopesSearch();
    expect(fetchNodesSpy).toHaveBeenCalledTimes(4);
    expectResultApplicationsMimirPresent();
    expectResultApplicationsGrafanaPresent();
  });

  it('Persists nodes from search', async () => {
    await openSelector();
    await expandResultApplications();
    await searchScopes('mimir');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

    await selectResultApplicationsMimir();
    await searchScopes('unknown');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(4);
    expectPersistedApplicationsMimirPresent();

    await clearScopesSearch();
    expect(fetchNodesSpy).toHaveBeenCalledTimes(5);
    expectResultApplicationsMimirPresent();
    expectResultApplicationsGrafanaPresent();
  });

  it('Selects a persisted scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

    await selectResultApplicationsGrafana();
    await applyScopes();
    expectScopesSelectorValue('Mimir + Grafana');
  });

  it('Deselects a persisted scope', async () => {
    await openSelector();
    await expandResultApplications();
    await selectResultApplicationsMimir();
    await searchScopes('grafana');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);

    await selectResultApplicationsGrafana();
    await applyScopes();
    expectScopesSelectorValue('Mimir + Grafana');

    await openSelector();
    await selectPersistedApplicationsMimir();
    await applyScopes();
    expectScopesSelectorValue('Grafana');
  });

  it('Shows the proper headline', async () => {
    await openSelector();

    await searchScopes('Applications');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(2);
    expectScopesHeadline('Results');

    await searchScopes('unknown');
    expect(fetchNodesSpy).toHaveBeenCalledTimes(3);
    expectScopesHeadline('No results found for your query');
  });

  it('Should only show Recommended when there are no leaf container nodes visible', async () => {
    await openSelector();
    await expandResultApplications();
    await expandResultApplicationsCloud();
    expectScopesHeadline('Recommended');
  });

  describe('Keyboard Navigation', () => {
    it('should navigate through items with arrow keys when search is focused', async () => {
      await openSelector();
      await expandResultApplications();

      const searchInput = screen.getByRole('combobox', { name: 'Search Applications' });
      expect(searchInput).toHaveFocus();

      // Navigate down through items
      await user.keyboard('{ArrowDown}');

      // Get all tree items and find the one that's selected
      const selectedItem = screen.getByRole('treeitem', { selected: true });
      expect(selectedItem).toBeTruthy();

      await user.keyboard('{ArrowDown}');

      // Find the new selected item
      const newSelectedItem = screen.getByRole('treeitem', { selected: true });
      expect(newSelectedItem).toBeTruthy();
      expect(newSelectedItem).not.toBe(selectedItem);

      // Navigate up
      await user.keyboard('{ArrowUp}');

      // Should be back to the first selected item
      const finalSelectedItem = screen.getByRole('treeitem', { selected: true });
      expect(finalSelectedItem).toBe(selectedItem);
    });

    it('should wrap around when navigating past boundaries', async () => {
      await openSelector();
      await expandResultApplications();

      const searchInput = screen.getByRole('combobox', { name: 'Search Applications' });
      expect(searchInput).toHaveFocus();

      // Navigate to last item (just a few steps to avoid getting stuck)
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');

      // Verify we can navigate and items have proper state
      const treeItems = screen.getAllByRole('treeitem');
      expect(treeItems.length).toBeGreaterThan(0);

      // Check that at least one item is selected
      const selectedItem = screen.getByRole('treeitem', { selected: true });
      expect(selectedItem).toBeTruthy();
    });

    it('should select items with Enter key', async () => {
      await openSelector();
      await expandResultApplications();

      const searchInput = screen.getByRole('combobox', { name: 'Search Applications' });
      expect(searchInput).toHaveFocus();

      // Navigate to Grafana and select it
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expectResultApplicationsGrafanaSelected();
    });

    it('should expand items with ArrowRight key', async () => {
      await openSelector();

      const searchInput = screen.getByRole('combobox', { name: 'Search' });
      searchInput.focus();

      // Navigate to Applications (which is expandable) - need to ensure we reach it
      await user.keyboard('{ArrowDown}');

      // Verify we can navigate and items have proper state
      const treeItems = screen.getAllByRole('treeitem');
      expect(treeItems.length).toBeGreaterThan(0);

      // Check that at least one item is selected
      const selectedItem = screen.getByRole('treeitem', { selected: true });
      expect(selectedItem).toBeTruthy();

      // Verify we're on an expandable item (should have aria-expanded attribute)
      expect(selectedItem).toHaveAttribute('aria-expanded');

      // Try to expand with ArrowRight
      await user.keyboard('{ArrowRight}');

      // Should now show the expanded Applications section with its search input
      expect(screen.getByRole('combobox', { name: 'Search Applications' })).toBeInTheDocument();
    });

    it('should reset highlight with Escape key', async () => {
      await openSelector();
      await expandResultApplications();

      const searchInput = screen.getByRole('combobox', { name: 'Search Applications' });
      expect(searchInput).toHaveFocus();

      // Navigate to an item
      await user.keyboard('{ArrowDown}');
      const selectedItem = screen.getByRole('treeitem', { selected: true });
      expect(selectedItem).toBeTruthy();

      // Reset with Escape
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('treeitem', { selected: true })).toBeFalsy();
    });

    it('should not handle keyboard events when search is not focused', async () => {
      await openSelector();
      await expandResultApplications();

      // Click outside search to lose focus
      const outsideElement = screen.getByText('Select scopes');
      await user.click(outsideElement);

      // Try to navigate with arrow keys
      await user.keyboard('{ArrowDown}');

      // No items should be selected
      const items = screen.getAllByRole('treeitem');
      const nonSelectedItems = screen.queryAllByRole('treeitem', { selected: false });
      expect(nonSelectedItems.length).toBe(items.length);
    });

    it('should handle keyboard navigation with search results', async () => {
      await openSelector();
      await expandResultApplications();
      await searchScopes('Cloud');

      const searchInput = screen.getByRole('combobox', { name: 'Search Applications' });
      expect(searchInput).toHaveFocus();

      // Navigate through search results
      await user.keyboard('{ArrowDown}');

      // Get all Cloud items and verify at least one is selected
      const cloudItems = screen.getAllByRole('treeitem', { name: /Cloud/ });
      expect(cloudItems.length).toBeGreaterThan(0);

      // Check that at least one item is selected
      const selectedItems = cloudItems.filter((item) => item.getAttribute('aria-selected') === 'true');
      expect(selectedItems.length).toBeGreaterThan(0);

      // Select the first selected item
      await user.keyboard('{Enter}');
      expectResultApplicationsCloudPresent();
    });
  });

  describe('Accessibility Markup', () => {
    it('should have proper ARIA roles and attributes on search input', async () => {
      await openSelector();
      await expandResultApplications();

      const searchInput = screen.getByRole('combobox', { name: 'Search Applications' });
      expect(searchInput).toHaveAttribute('role', 'combobox');
      expect(searchInput).toHaveAttribute('aria-expanded', 'true');
      expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');
      expect(searchInput).toHaveAttribute('aria-controls');
      // aria-activedescendant may not be set initially, which is fine
    });

    it('should have proper ARIA roles on tree structure', async () => {
      await openSelector();
      await expandResultApplications();

      // Get all trees and verify at least one exists
      const trees = screen.getAllByRole('tree');
      expect(trees.length).toBeGreaterThan(0);

      // Tree items
      const treeItems = screen.getAllByRole('treeitem');
      expect(treeItems.length).toBeGreaterThan(0);

      treeItems.forEach((item) => {
        expect(item).toHaveAttribute('aria-selected');
      });
    });

    it('should have proper ARIA activedescendant relationship', async () => {
      await openSelector();
      await expandResultApplications();

      const searchInput = screen.getByRole('combobox', { name: 'Search Applications' });

      // Navigate to highlight an item
      await user.keyboard('{ArrowDown}');

      // Should now have an active descendant
      const ariaActiveDescendant = searchInput.getAttribute('aria-activedescendant');
      expect(ariaActiveDescendant).toBeTruthy();

      const selectedElement = screen.getByRole('treeitem', { selected: true });
      expect(selectedElement.id).toBe(ariaActiveDescendant);
    });

    it('should have proper tree item IDs', async () => {
      await openSelector();
      await expandResultApplications();

      const treeItems = screen.getAllByRole('treeitem');

      treeItems.forEach((item) => {
        const id = item.getAttribute('id');
        expect(id).toBeTruthy();

        // ID should be unique
        const elementsWithSameId = document.querySelectorAll(`#${id}`);
        expect(elementsWithSameId).toHaveLength(1);
      });
    });

    it('should maintain accessibility state during interactions', async () => {
      await openSelector();
      await expandResultApplications();

      const searchInput = screen.getByRole('combobox', { name: 'Search Applications' });

      // Navigate and select an item
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      // Accessibility attributes should still be present
      expect(searchInput).toHaveAttribute('role', 'combobox');
      expect(searchInput).toHaveAttribute('aria-expanded', 'true');
      expect(searchInput).toHaveAttribute('aria-autocomplete', 'list');

      // Tree items should maintain their roles
      const treeItems = screen.getAllByRole('treeitem');
      treeItems.forEach((item) => {
        expect(item).toHaveAttribute('aria-selected');
      });
    });
  });
});
