import { render, screen } from 'test/test-utils';
import { byRole, byTestId } from 'testing-library-selector';

import { ComponentTypeWithExtensionMeta, PluginExtensionComponentMeta, PluginExtensionTypes } from '@grafana/data';
import { locationService, setPluginComponentsHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';

import * as analytics from '../../Analytics';
import { setupPluginsExtensionsHook } from '../../testSetup/plugins';

// Mock contextSrv before importing the component since permission check happens at module level
jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

import RulesFilterV2 from './Filter/RulesFilter.v2';

setupMswServer();

jest.spyOn(analytics, 'trackFilterButtonClick');
jest.spyOn(analytics, 'trackFilterButtonApplyClick');
jest.spyOn(analytics, 'trackFilterButtonClearClick');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: jest.fn().mockReturnValue([
      { name: 'Prometheus', uid: 'prometheus-uid' },
      { name: 'Loki', uid: 'loki-uid' },
    ]),
  }),
}));

jest.mock('./MultipleDataSourcePicker', () => {
  const original = jest.requireActual('./MultipleDataSourcePicker');
  return {
    ...original,
    MultipleDataSourcePicker: () => null,
  };
});

jest.mock('../../plugins/useAlertingHomePageExtensions', () => ({
  useAlertingHomePageExtensions: jest.fn(() => {
    const { usePluginComponents } = jest.requireActual('@grafana/runtime');
    const { PluginExtensionPoints } = jest.requireActual('@grafana/data');
    return usePluginComponents({
      extensionPointId: PluginExtensionPoints.AlertingHomePage,
      limitPerPlugin: 1,
    });
  }),
}));

setupPluginsExtensionsHook();

// Helper function to create mock plugin components
function createMockComponent(pluginId: string): ComponentTypeWithExtensionMeta<{}> {
  function MockComponent() {
    return <div>Test Plugin Component</div>;
  }

  MockComponent.meta = {
    id: `test-component-${pluginId}`,
    pluginId,
    title: 'Test Component',
    description: 'Test plugin component',
    type: PluginExtensionTypes.component,
  } satisfies PluginExtensionComponentMeta;

  return MockComponent as ComponentTypeWithExtensionMeta<{}>;
}

const ui = {
  searchInput: byTestId('search-query-input'),
  filterButton: byRole('button', { name: 'Filter' }),
  applyButton: byTestId('filter-apply-button'),
  clearButton: byTestId('filter-clear-button'),
  ruleNameInput: byTestId('rule-name-input'),
};

beforeEach(() => {
  locationService.replace({ search: '' });
  jest.clearAllMocks();

  // Reset plugin components hook to default (no plugins)
  setPluginComponentsHook(() => ({
    components: [],
    isLoading: false,
  }));
});

describe('RulesFilterV2', () => {
  it('Should render component without crashing', () => {
    render(<RulesFilterV2 />);

    expect(ui.searchInput.get()).toBeInTheDocument();
    expect(ui.filterButton.get()).toBeInTheDocument();
  });

  it('Should allow typing in search input', async () => {
    const { user } = render(<RulesFilterV2 />);

    await user.type(ui.searchInput.get(), 'test search');
    expect(ui.searchInput.get()).toHaveValue('test search');
  });

  it('Should open filter popup when filter button is clicked', async () => {
    const { user } = render(<RulesFilterV2 />);
    await user.click(ui.filterButton.get());
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('Should close popup when clicking outside', async () => {
    const { user } = render(<RulesFilterV2 />);
    await user.click(ui.filterButton.get());
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument();
  });

  it('Should clear filters when clicking clear button', async () => {
    const { user } = render(<RulesFilterV2 />);
    await user.type(ui.searchInput.get(), 'test');
    expect(ui.searchInput.get()).toHaveValue('test');
    await user.click(ui.filterButton.get());
    await user.click(ui.clearButton.get());
    expect(ui.ruleNameInput.get()).toHaveValue('');
  });

  describe('Conditional Fields', () => {
    it('Should show contact point field when user has proper permissions', async () => {
      // Permission is already mocked to true at module level
      const { user } = render(<RulesFilterV2 />);
      await user.click(ui.filterButton.get());
      expect(screen.getByText('Contact point')).toBeInTheDocument();
    });

    it('Should show plugin filter when plugins are enabled', async () => {
      // Mock plugin components to simulate plugins available
      setPluginComponentsHook(() => ({
        components: [createMockComponent('test-plugin')],
        isLoading: false,
      }));

      const { user } = render(<RulesFilterV2 />);
      await user.click(ui.filterButton.get());
      expect(screen.queryByText('Plugin rules')).toBeInTheDocument();
    });

    it('Should hide plugin filter when no plugins are available', async () => {
      // Mock plugin components to return no components
      setPluginComponentsHook(() => ({
        components: [],
        isLoading: false,
      }));

      const { user } = render(<RulesFilterV2 />);
      await user.click(ui.filterButton.get());
      expect(screen.queryByText('Plugin rules')).not.toBeInTheDocument();
    });
  });

  describe('Analytics Tracking', () => {
    it('Should track filter button clicks when opening popup', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.click(ui.filterButton.get());

      expect(analytics.trackFilterButtonClick).toHaveBeenCalledTimes(1);
    });

    it('Should track clear button clicks', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.click(ui.filterButton.get());
      await user.click(ui.clearButton.get());

      expect(analytics.trackFilterButtonClearClick).toHaveBeenCalledTimes(1);
    });

    it('Should track apply button clicks with filter values', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.click(ui.filterButton.get());
      await user.click(ui.applyButton.get());

      expect(analytics.trackFilterButtonApplyClick).toHaveBeenCalledTimes(1);
    });

    it('Should not track filter button click when filter button is clicked to close popup', async () => {
      const { user } = render(<RulesFilterV2 />);

      await user.click(ui.filterButton.get());
      expect(analytics.trackFilterButtonClick).toHaveBeenCalledTimes(1);

      await user.click(document.body);

      jest.clearAllMocks();

      await user.click(ui.filterButton.get());
      expect(analytics.trackFilterButtonClick).toHaveBeenCalledTimes(1);
    });
  });
});
