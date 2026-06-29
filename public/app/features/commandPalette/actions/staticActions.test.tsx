import { type ReactNode } from 'react';
import { getWrapper, renderHook } from 'test/test-utils';

import { config } from '@grafana/runtime';
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

let mockTestDataSources: Array<{ name: string; uid: string; type: string }> = [
  { name: 'Test Data Source', uid: 'test-data-source-uid', type: 'grafana-testdata-datasource' },
];

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: jest.fn(() => mockTestDataSources),
  }),
}));

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
    mockTestDataSources = [
      { name: 'Test Data Source', uid: 'test-data-source-uid', type: 'grafana-testdata-datasource' },
    ];
    mockGetDashboardTemplatesTab.mockReturnValue(null);
    setTestFlags({ 'grafana.customDashboardTemplates': false });
  });

  it('includes the action when the Grafana templates feature toggle is enabled', () => {
    const { result } = renderStaticActions();
    expect(hasTemplateAction(result.current)).toBe(true);
  });

  it('does not include the action when neither templates feature is enabled', () => {
    config.featureToggles.dashboardTemplates = false;
    const { result } = renderStaticActions();
    expect(hasTemplateAction(result.current)).toBe(false);
  });

  it('includes the action when only custom templates are enabled, even without a test datasource', () => {
    config.featureToggles.dashboardTemplates = false;
    mockTestDataSources = [];
    mockGetDashboardTemplatesTab.mockReturnValue(() => null);
    setTestFlags({ 'grafana.customDashboardTemplates': true });

    const { result } = renderStaticActions();
    expect(hasTemplateAction(result.current)).toBe(true);
  });
});
