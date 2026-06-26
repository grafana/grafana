import { type ReactNode } from 'react';
import { getWrapper, renderHook } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import { configureStore } from 'app/store/configureStore';

import { type CommandPaletteAction } from '../types';

import { useStaticActions } from './staticActions';

jest.mock(
  'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension',
  () => ({
    getDashboardTemplatesTab: jest.fn(() => null),
  })
);

const mockGetDashboardTemplatesTab = jest.mocked(getDashboardTemplatesTab);

const defaultTestDataSource = {
  name: 'Test Data Source',
  uid: 'test-data-source-uid',
  type: 'grafana-testdata-datasource',
} as DataSourceInstanceListItem;

// Mock the async list hook directly. Its fallback to `getDataSourceSrv().getList()` does
// not see jest.mock on `@grafana/runtime` because the runtime package imports the legacy
// service via internal relative paths.
jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceList: jest.fn(() => ({ isLoading: false, items: [] })),
}));

const mockUseDataSourceInstanceList = jest.mocked(useDataSourceInstanceList);

function renderStaticActions() {
  const store = configureStore({ navBarTree: [] });
  const Wrapper = getWrapper({ store, renderWithRouter: true });
  const wrapper = ({ children }: { children: ReactNode }) => <Wrapper>{children}</Wrapper>;
  return renderHook(() => useStaticActions(), { wrapper });
}

const hasTemplateAction = (actions: CommandPaletteAction[]) =>
  actions.some((action) => action.id === 'browse-template-dashboard');

describe('useStaticActions - dashboard from template action', () => {
  beforeEach(() => {
    config.featureToggles.dashboardTemplates = true;
    // Reset to defaults: a test datasource is available, custom templates are off.
    mockUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [defaultTestDataSource] });
    mockGetDashboardTemplatesTab.mockReturnValue(null);
    setTestFlags({ 'grafana.customDashboardTemplates': false });
  });

  it('includes the action when the Grafana templates feature toggle is enabled', () => {
    const { result } = renderStaticActions();
    expect(hasTemplateAction(result.current)).toBe(true);
  });

  it('does not include the action when neither templates feature is enabled', () => {
    config.featureToggles.dashboardTemplates = false;
    mockUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [] });
    const { result } = renderStaticActions();
    expect(hasTemplateAction(result.current)).toBe(false);
  });

  it('includes the action when only custom templates are enabled, even without a test datasource', () => {
    config.featureToggles.dashboardTemplates = false;
    mockUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [] });
    mockGetDashboardTemplatesTab.mockReturnValue(() => null);
    setTestFlags({ 'grafana.customDashboardTemplates': true });

    const { result } = renderStaticActions();
    expect(hasTemplateAction(result.current)).toBe(true);
  });
});
