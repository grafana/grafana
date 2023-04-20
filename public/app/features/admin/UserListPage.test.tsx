import { act, render, RenderResult, screen, waitForElementToBeRemoved } from '@testing-library/react';
import React from 'react';
import configureStore from 'redux-mock-store';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { GrafanaBootConfig } from '@grafana/runtime/src';
import config from 'app/core/config';

import { TestProvider } from '../../../test/helpers/TestProvider';
import { contextSrv } from '../../core/services/context_srv';
import { UserListAdminState, UsersState } from '../../types';

import UserListPage from './UserListPage';

const selectors = e2eSelectors.pages.UserListPage;
const tabsSelector = selectors.tabs;

// const mockStore = configureStore([]);

const renderPage = async () => {
  const usersState: UsersState = {
    users: [],
    searchQuery: '',
    page: 0,
    perPage: 30,
    totalPages: 1,
    canInvite: false,
    externalUserMngInfo: '',
    externalUserMngLinkName: '',
    externalUserMngLinkUrl: '',
    isLoading: false,
  };

  const userListState: UserListAdminState = {
    users: [],
    query: '',
    page: 0,
    perPage: 50,
    totalPages: 1,
    showPaging: false,
    filters: [{ name: 'activeLast30Days', value: false }],
    isLoading: false,
  };

  let wrapper: RenderResult;
  await act(() => {
    wrapper = render(
      <TestProvider storeState={{ users: usersState, userListAdmin: userListState }}>
        <UserListPage />
      </TestProvider>
    );
  });

  // await waitForElementToBeRemoved(wrapper!.getByTestId('Spinner'));

  return wrapper!;
};

let originalConfigData: GrafanaBootConfig;

beforeEach(() => {
  originalConfigData = { ...config };
});

afterEach(() => {
  config.featureToggles = originalConfigData.featureToggles;
  config.licenseInfo = originalConfigData.licenseInfo;
});

// jest.mock('./UserListAdminPage', () => ({
//   UserListAdminPageContent: jest.fn(),
// }));
// jest.mock('../users/UsersListPage', () => ({
//   UsersListPageContent: jest.fn(),
// }));

describe('Tabs rendering', () => {
  it('should render All and Org Users when user has permissions to read to org users and is admin', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    const wrapper = await renderPage()!;

    expect(wrapper.getByTestId(tabsSelector.allUsers)).toBeInTheDocument();
    expect(wrapper.getByTestId(tabsSelector.orgUsers)).toBeInTheDocument();
    expect(wrapper.queryByTestId(tabsSelector.publicDashboardsUsers)).not.toBeInTheDocument();
  });
  it('should render All,Org and Public Dashboard users when user has permissions to read org users, is admin and has email sharing enabled', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    config.featureToggles.publicDashboardsEmailSharing = true;
    config.featureToggles.publicDashboards = true;
    config.licenseInfo = { ...config.licenseInfo, enabledFeatures: { publicDashboardsEmailSharing: true } };

    renderPage();

    expect(screen.getByTestId(tabsSelector.allUsers)).toBeInTheDocument();
    expect(screen.getByTestId(tabsSelector.orgUsers)).toBeInTheDocument();
    expect(screen.getByTestId(tabsSelector.publicDashboardsUsers)).toBeInTheDocument();
  });
  describe('No permissions to read org users or not admin', () => {
    [
      {
        hasOrgReadPermissions: false,
        isAdmin: true,
      },
      {
        hasOrgReadPermissions: true,
        isAdmin: false,
      },
    ].forEach((scenario) => {
      it('should render no tabs when user has no permissions to read org users or is not admin', async () => {
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(scenario.hasOrgReadPermissions);
        jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(scenario.isAdmin);

        renderPage();

        expect(screen.queryByTestId(tabsSelector.allUsers)).not.toBeInTheDocument();
        expect(screen.queryByTestId(tabsSelector.orgUsers)).not.toBeInTheDocument();
        expect(screen.queryByTestId(tabsSelector.publicDashboardsUsers)).not.toBeInTheDocument();
      });
    });
  });
  describe('No permissions to read org users or not admin but email sharing', () => {
    [
      {
        title: 'user has no permissions to read org users',
        hasOrgReadPermissions: false,
        isAdmin: true,
      },
      {
        title: 'user is not admin',
        hasOrgReadPermissions: true,
        isAdmin: false,
      },
    ].forEach((scenario) => {
      it(`should render user and public dashboard tabs when ${scenario.title} but has email sharing enabled`, async () => {
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(scenario.hasOrgReadPermissions);
        jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(scenario.isAdmin);

        config.featureToggles.publicDashboardsEmailSharing = true;
        config.featureToggles.publicDashboards = true;
        config.licenseInfo = { ...config.licenseInfo, enabledFeatures: { publicDashboardsEmailSharing: true } };

        renderPage();

        expect(screen.queryByTestId(tabsSelector.allUsers)).not.toBeInTheDocument();
        expect(screen.queryByTestId(tabsSelector.orgUsers)).not.toBeInTheDocument();

        expect(screen.getByTestId(tabsSelector.users)).toBeInTheDocument();
        expect(screen.getByTestId(tabsSelector.publicDashboardsUsers)).toBeInTheDocument();
      });
    });
  });
});

describe('Tables rendering', () => {
  it('should render UserListAdminPageContent page when user is admin', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    await renderPage();

    expect(screen.getByTestId(tabsSelector.allUsers).className.includes('activeTabStyle')).toBeTruthy();
    expect(screen.getByTestId(selectors.UserListAdminPage.container)).toBeInTheDocument();
  });
  // it('should render All,Org and Public Dashboard users when user has permissions to read org users, is admin and has email sharing enabled', async () => {
  //   jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
  //   jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  //
  //   config.featureToggles.publicDashboardsEmailSharing = true;
  //   config.featureToggles.publicDashboards = true;
  //   config.licenseInfo = { ...config.licenseInfo, enabledFeatures: { publicDashboardsEmailSharing: true } };
  //
  //   renderPage();
  //
  //   expect(screen.getByTestId(selectors.allUsers)).toBeInTheDocument();
  //   expect(screen.getByTestId(selectors.orgUsers)).toBeInTheDocument();
  //   expect(screen.getByTestId(selectors.publicDashboardsUsers)).toBeInTheDocument();
  // });
  // describe('No permissions to read org users or not admin', () => {
  //   [
  //     {
  //       hasOrgReadPermissions: false,
  //       isAdmin: true,
  //     },
  //     {
  //       hasOrgReadPermissions: true,
  //       isAdmin: false,
  //     },
  //   ].forEach((scenario) => {
  //     it('should render no tabs when user has no permissions to read org users or is not admin', async () => {
  //       jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(scenario.hasOrgReadPermissions);
  //       jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(scenario.isAdmin);
  //
  //       renderPage();
  //
  //       expect(screen.queryByTestId(selectors.allUsers)).not.toBeInTheDocument();
  //       expect(screen.queryByTestId(selectors.orgUsers)).not.toBeInTheDocument();
  //       expect(screen.queryByTestId(selectors.publicDashboardsUsers)).not.toBeInTheDocument();
  //     });
  //   });
  // });
  // describe('No permissions to read org users or not admin but email sharing', () => {
  //   [
  //     {
  //       title: 'user has no permissions to read org users',
  //       hasOrgReadPermissions: false,
  //       isAdmin: true,
  //     },
  //     {
  //       title: 'user is not admin',
  //       hasOrgReadPermissions: true,
  //       isAdmin: false,
  //     },
  //   ].forEach((scenario) => {
  //     it(`should render user and public dashboard tabs when ${scenario.title} but has email sharing enabled`, async () => {
  //       jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(scenario.hasOrgReadPermissions);
  //       jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(scenario.isAdmin);
  //
  //       config.featureToggles.publicDashboardsEmailSharing = true;
  //       config.featureToggles.publicDashboards = true;
  //       config.licenseInfo = { ...config.licenseInfo, enabledFeatures: { publicDashboardsEmailSharing: true } };
  //
  //       renderPage();
  //
  //       expect(screen.queryByTestId(selectors.allUsers)).not.toBeInTheDocument();
  //       expect(screen.queryByTestId(selectors.orgUsers)).not.toBeInTheDocument();
  //
  //       expect(screen.getByTestId(selectors.users)).toBeInTheDocument();
  //       expect(screen.getByTestId(selectors.publicDashboardsUsers)).toBeInTheDocument();
  //     });
  //   });
  // });
});
