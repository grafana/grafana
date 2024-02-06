import { render, screen } from '@testing-library/react';
import React from 'react';
import { match } from 'react-router-dom';
import { TestProvider } from 'test/helpers/TestProvider';

import { createTheme } from '@grafana/data';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';

import { Team } from '../../types';

import { Props, TeamPages } from './TeamPages';
import { getMockTeam } from './__mocks__/teamMocks';

jest.mock('app/core/components/Select/UserPicker', () => {
  return { UserPicker: () => null };
});

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    accessControlEnabled: () => true,
    hasPermissionInMetadata: () => true,
    user: {},
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({
    get: jest.fn().mockResolvedValue([{ userId: 1, login: 'Test' }]),
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    licenseInfo: {
      enabledFeatures: { teamsync: true },
      stateInfo: '',
      licenseUrl: '',
    },
    featureToggles: { accesscontrol: true },
    bootData: { navTree: [], user: {} },
    buildInfo: {
      edition: 'Open Source',
      version: '7.5.0',
      commit: 'abc123',
      env: 'production',
      latestVersion: '',
      hasUpdate: false,
      hideVersion: false,
    },
    appSubUrl: '',
  },
  featureEnabled: () => true,
}));

// Mock connected child components instead of rendering them
jest.mock('./TeamSettings', () => {
  //eslint-disable-next-line
  return () => <div>Team settings</div>;
});

jest.mock('./TeamGroupSync', () => {
  //eslint-disable-next-line
  return () => <div>Team group sync</div>;
});

const setup = (propOverrides?: object) => {
  const props: Props = {
    ...getRouteComponentProps({
      match: {
        params: {
          id: '1',
          page: null,
        },
      } as unknown as match,
    }),
    pageNav: { text: 'Cool team ' },
    teamId: 1,
    loadTeam: jest.fn(),
    pageName: 'members',
    team: {} as Team,
    theme: createTheme(),
  };

  Object.assign(props, propOverrides);

  render(
    <TestProvider>
      <TeamPages {...props} />
    </TestProvider>
  );
};

describe('TeamPages', () => {
  it('should render settings and preferences page', async () => {
    setup({
      team: getMockTeam(),
      pageName: 'settings',
      preferences: {
        homeDashboardUID: 'home-dashboard',
        theme: 'Default',
        timezone: 'Default',
      },
    });

    expect(await screen.findByText('Team settings')).toBeInTheDocument();
  });

  it('should render group sync page', async () => {
    setup({
      team: getMockTeam(),
      pageName: 'groupsync',
    });

    expect(await screen.findByText('Team group sync')).toBeInTheDocument();
  });
});
