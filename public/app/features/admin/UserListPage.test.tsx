import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { GrafanaBootConfig } from '@grafana/runtime/src';
import config from 'app/core/config';

import { TestProvider } from '../../../test/helpers/TestProvider';
import { contextSrv } from '../../core/services/context_srv';

import UserListPage from './UserListPage';

const selectors = e2eSelectors.pages.UserListPage;
const tabsSelector = selectors.tabs;

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ get: jest.fn().mockResolvedValue([]) }),
}));

jest.mock('./UserListAdminPage', () => ({
  UserListAdminPageContent: () => <div data-testid={selectors.UserListAdminPage.container} />,
}));
jest.mock('../users/UsersListPage', () => ({
  UsersListPageContent: () => <div data-testid={selectors.UsersListPage.container} />,
}));
jest.mock('./UserListPublicDashboardPage/UserListPublicDashboardPage', () => ({
  UserListPublicDashboardPage: () => <div data-testid={selectors.UsersListPublicDashboardsPage.container} />,
}));

const renderPage = () => {
  render(
    <TestProvider>
      <UserListPage />
    </TestProvider>
  );
};

const enableEmailSharing = () => {
  config.featureToggles.publicDashboardsEmailSharing = true;
  config.licenseInfo = { ...config.licenseInfo, enabledFeatures: { publicDashboardsEmailSharing: true } };
};

let originalConfigData: GrafanaBootConfig;

beforeEach(() => {
  originalConfigData = { ...config };
});

afterEach(() => {
  config.featureToggles = originalConfigData.featureToggles;
  config.licenseInfo = originalConfigData.licenseInfo;
});

describe('Tabs rendering', () => {
  it('should render All and Org Users tabs when user has permissions to read to org users and is admin', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    renderPage();

    expect(screen.getByTestId(tabsSelector.allUsers)).toBeInTheDocument();
    expect(screen.getByTestId(tabsSelector.orgUsers)).toBeInTheDocument();
    expect(screen.queryByTestId(tabsSelector.publicDashboardsUsers)).not.toBeInTheDocument();
  });
  it('should render All, Org and Public dashboard tabs when user has permissions to read org users, is admin and has email sharing enabled', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    enableEmailSharing();
    renderPage();

    expect(screen.getByTestId(tabsSelector.allUsers)).toBeInTheDocument();
    expect(screen.getByTestId(tabsSelector.orgUsers)).toBeInTheDocument();
    expect(screen.getByTestId(tabsSelector.publicDashboardsUsers)).toBeInTheDocument();
  });
  describe('No permissions to read org users or not admin', () => {
    it('should render no tabs when user has no permissions to read org users', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      renderPage();

      expect(screen.queryByTestId(tabsSelector.allUsers)).not.toBeInTheDocument();
      expect(screen.queryByTestId(tabsSelector.orgUsers)).not.toBeInTheDocument();
      expect(screen.queryByTestId(tabsSelector.publicDashboardsUsers)).not.toBeInTheDocument();
    });
  });
  describe('No permissions to read org users but email sharing enabled', () => {
    it(`should render User and Public dashboard tabs when no permissions to read org users but has email sharing enabled`, async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      enableEmailSharing();
      renderPage();

      expect(screen.queryByTestId(tabsSelector.allUsers)).not.toBeInTheDocument();
      expect(screen.queryByTestId(tabsSelector.orgUsers)).not.toBeInTheDocument();

      expect(screen.getByTestId(tabsSelector.users)).toBeInTheDocument();
      expect(screen.getByTestId(tabsSelector.publicDashboardsUsers)).toBeInTheDocument();
    });
  });
});

describe('Tables rendering', () => {
  it('should render UserListAdminPage when user is admin', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    renderPage();

    expect(screen.getByTestId(tabsSelector.allUsers).className.includes('activeTabStyle')).toBeTruthy();
    expect(screen.getByTestId(tabsSelector.orgUsers)).toBeInTheDocument();

    expect(screen.getByTestId(selectors.UserListAdminPage.container)).toBeInTheDocument();
  });
  it('should render UsersListPage when user is admin and has org read permissions', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    renderPage();

    expect(screen.getByTestId(tabsSelector.allUsers).className.includes('activeTabStyle')).toBeTruthy();
    expect(screen.getByTestId(tabsSelector.orgUsers)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.UserListAdminPage.container)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId(tabsSelector.orgUsers));
    expect(screen.getByTestId(tabsSelector.orgUsers).className.includes('activeTabStyle')).toBeTruthy();
    expect(screen.getByTestId(selectors.UsersListPage.container)).toBeInTheDocument();
  });
  it('should render UsersListPage when user has org read permissions and is not admin', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    renderPage();

    expect(screen.queryByTestId(tabsSelector.allUsers)).not.toBeInTheDocument();
    expect(screen.queryByTestId(tabsSelector.orgUsers)).not.toBeInTheDocument();
    expect(screen.queryByTestId(tabsSelector.users)).not.toBeInTheDocument();
    expect(screen.queryByTestId(tabsSelector.publicDashboardsUsers)).not.toBeInTheDocument();

    expect(screen.getByTestId(selectors.UsersListPage.container)).toBeInTheDocument();
  });
  it('should render UserListPublicDashboardPage when user has email sharing enabled and is not admin', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    enableEmailSharing();
    renderPage();

    expect(screen.queryByTestId(tabsSelector.allUsers)).not.toBeInTheDocument();
    expect(screen.queryByTestId(tabsSelector.orgUsers)).not.toBeInTheDocument();

    expect(screen.queryByTestId(tabsSelector.users)).toBeInTheDocument();
    expect(screen.queryByTestId(tabsSelector.publicDashboardsUsers)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId(tabsSelector.publicDashboardsUsers));
    expect(screen.getByTestId(tabsSelector.publicDashboardsUsers).className.includes('activeTabStyle')).toBeTruthy();
    expect(screen.getByTestId(selectors.UsersListPublicDashboardsPage.container)).toBeInTheDocument();
  });
  it('should render UsersListPage when user is not admin and does not have nor org read perms neither email sharing enabled', async () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    renderPage();

    expect(screen.queryByTestId(tabsSelector.allUsers)).not.toBeInTheDocument();
    expect(screen.queryByTestId(tabsSelector.orgUsers)).not.toBeInTheDocument();

    expect(screen.queryByTestId(tabsSelector.users)).not.toBeInTheDocument();
    expect(screen.queryByTestId(tabsSelector.publicDashboardsUsers)).not.toBeInTheDocument();

    expect(screen.getByTestId(selectors.UsersListPage.container)).toBeInTheDocument();
  });
});
