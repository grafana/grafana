import { type ActionImpl } from 'kbar';
import { type ReactNode } from 'react';
import { getWrapper, renderHook } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import { configureStore } from 'app/store/configureStore';
import { type UserPermission, AccessControlAction } from 'app/types/accessControl';

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

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceList: jest.fn(() => ({ isLoading: false, items: [] })),
}));

const mockUseDataSourceInstanceList = jest.mocked(useDataSourceInstanceList);

let mockQueryLibraryContext = { queryLibraryEnabled: false, openDrawer: jest.fn() };
jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  ...jest.requireActual('app/features/explore/QueryLibrary/QueryLibraryContext'),
  useQueryLibraryContext: () => mockQueryLibraryContext,
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
  let originalPermissions: UserPermission | undefined;

  beforeEach(() => {
    config.featureToggles.dashboardTemplates = true;
    // Reset to defaults: a test datasource is available, custom templates are off.
    mockUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [defaultTestDataSource] });
    mockGetDashboardTemplatesTab.mockReturnValue(null);
    setTestFlags({ 'grafana.customDashboardTemplates': false });
    // The entry point requires dashboard-create permission, mirroring QuickAdd.
    originalPermissions = contextSrv.user.permissions;
    contextSrv.user.permissions = { [AccessControlAction.DashboardsCreate]: true };
  });

  afterEach(() => {
    contextSrv.user.permissions = originalPermissions;
  });

  it('includes the action when the Grafana templates feature toggle is enabled', () => {
    const { result } = renderStaticActions();
    expect(hasTemplateAction(result.current)).toBe(true);
  });

  it('does not include the action when the user lacks dashboards:create permission', () => {
    contextSrv.user.permissions = {};
    const { result } = renderStaticActions();
    expect(hasTemplateAction(result.current)).toBe(false);
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
    // Custom templates require the read permission in addition to dashboard-create.
    contextSrv.user.permissions = {
      [AccessControlAction.DashboardsCreate]: true,
      [AccessControlAction.DashboardTemplatesRead]: true,
    };

    const { result } = renderStaticActions();
    expect(hasTemplateAction(result.current)).toBe(true);
  });

  it('does not include the action for custom-only templates without dashboardtemplates:read', () => {
    config.featureToggles.dashboardTemplates = false;
    mockUseDataSourceInstanceList.mockReturnValue({ isLoading: false, items: [] });
    mockGetDashboardTemplatesTab.mockReturnValue(() => null);
    setTestFlags({ 'grafana.customDashboardTemplates': true });
    // Has dashboard-create but not the templates read permission.
    contextSrv.user.permissions = { [AccessControlAction.DashboardsCreate]: true };

    const { result } = renderStaticActions();
    expect(hasTemplateAction(result.current)).toBe(false);
  });
});

const hasSavedQueriesAction = (actions: CommandPaletteAction[]) =>
  actions.some((action) => action.id === 'open-saved-queries');

const getSavedQueriesAction = (actions: CommandPaletteAction[]) =>
  actions.find((action) => action.id === 'open-saved-queries');

describe('useStaticActions - open saved queries action', () => {
  let originalPermissions: UserPermission | undefined;
  let originalIsSignedIn: boolean;
  let originalSavedQueriesRBAC: boolean | undefined;

  beforeEach(() => {
    mockQueryLibraryContext = { queryLibraryEnabled: true, openDrawer: jest.fn() };
    originalPermissions = contextSrv.user.permissions;
    originalIsSignedIn = contextSrv.isSignedIn;
    originalSavedQueriesRBAC = config.featureToggles.savedQueriesRBAC;
    // Default: RBAC off, so read access falls back to being signed in.
    config.featureToggles.savedQueriesRBAC = false;
    contextSrv.isSignedIn = true;
    contextSrv.user.permissions = {};
  });

  afterEach(() => {
    contextSrv.user.permissions = originalPermissions;
    contextSrv.isSignedIn = originalIsSignedIn;
    config.featureToggles.savedQueriesRBAC = originalSavedQueriesRBAC;
  });

  it('includes the action when the query library is enabled and the user is signed in', () => {
    const { result } = renderStaticActions();
    expect(hasSavedQueriesAction(result.current)).toBe(true);
  });

  it('does not include the action when the query library is disabled', () => {
    mockQueryLibraryContext.queryLibraryEnabled = false;
    const { result } = renderStaticActions();
    expect(hasSavedQueriesAction(result.current)).toBe(false);
  });

  it('does not include the action when the user is not signed in and RBAC is off', () => {
    contextSrv.isSignedIn = false;
    const { result } = renderStaticActions();
    expect(hasSavedQueriesAction(result.current)).toBe(false);
  });

  it('includes the action when RBAC is on and the user has queries:read', () => {
    config.featureToggles.savedQueriesRBAC = true;
    contextSrv.user.permissions = { [AccessControlAction.QueriesRead]: true };
    const { result } = renderStaticActions();
    expect(hasSavedQueriesAction(result.current)).toBe(true);
  });

  it('does not include the action when RBAC is on and the user lacks queries:read', () => {
    config.featureToggles.savedQueriesRBAC = true;
    contextSrv.user.permissions = {};
    const { result } = renderStaticActions();
    expect(hasSavedQueriesAction(result.current)).toBe(false);
  });

  it('opens the drawer with the command-palette context when performed', () => {
    const { result } = renderStaticActions();
    const action = getSavedQueriesAction(result.current);
    // perform ignores its ActionImpl argument, so a placeholder is enough to invoke it.
    action?.perform?.({} as ActionImpl);
    expect(mockQueryLibraryContext.openDrawer).toHaveBeenCalledWith({ options: { context: 'command-palette' } });
  });
});
