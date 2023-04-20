import { render, screen } from '@testing-library/react';
import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { GrafanaBootConfig } from '@grafana/runtime/src';
import config from 'app/core/config';

import { TestProvider } from '../../../test/helpers/TestProvider';
import { contextSrv } from '../../core/services/context_srv';

import UserListPage from './UserListPage';

jest.mock('./UserListAdminPage', () => ({
  UserListAdminPageContent: jest.fn(),
}));
jest.mock('../users/UsersListPage', () => ({
  UsersListPageContent: jest.fn(),
}));

const selectors = e2eSelectors.pages.UserListPage.tabs;

const renderPage = () => {
  render(
    <TestProvider>
      <UserListPage />
    </TestProvider>
  );
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
  it('should render All and Org Users when user has permissions to read to org users and is admin', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    renderPage();

    expect(screen.getByTestId(selectors.allUsers)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.orgUsers)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.publicDashboardsUsers)).not.toBeInTheDocument();
  });
  it('should render All,Org and Public Dashboard users when user has permissions to read org users, is admin and has email sharing enabled', async () => {
    jest.spyOn(contextSrv, 'hasAccess').mockReturnValue(true);
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);

    config.featureToggles.publicDashboardsEmailSharing = true;
    config.featureToggles.publicDashboards = true;
    config.licenseInfo = { ...config.licenseInfo, enabledFeatures: { publicDashboardsEmailSharing: true } };

    renderPage();

    expect(screen.getByTestId(selectors.allUsers)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.orgUsers)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.publicDashboardsUsers)).toBeInTheDocument();
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

        expect(screen.queryByTestId(selectors.allUsers)).not.toBeInTheDocument();
        expect(screen.queryByTestId(selectors.orgUsers)).not.toBeInTheDocument();
        expect(screen.queryByTestId(selectors.publicDashboardsUsers)).not.toBeInTheDocument();
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

        expect(screen.queryByTestId(selectors.allUsers)).not.toBeInTheDocument();
        expect(screen.queryByTestId(selectors.orgUsers)).not.toBeInTheDocument();

        expect(screen.getByTestId(selectors.users)).toBeInTheDocument();
        expect(screen.getByTestId(selectors.publicDashboardsUsers)).toBeInTheDocument();
      });
    });
  });
});
