import { screen } from '@testing-library/react';
import { useParams } from 'react-router-dom-v5-compat';
import { render } from 'test/test-utils';

import TeamPages from './TeamPages';
import { getMockTeam } from './mocks/teamMocks';

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
    get: jest.fn().mockResolvedValue(getMockTeam()),
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    licenseInfo: {
      enabledFeatures: { teamsync: true },
      stateInfo: '',
      licenseUrl: '',
    },
    featureToggles: { accesscontrol: true },
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

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  useParams: jest.fn(),
}));

const setup = (propOverrides: { teamUid?: string; pageName?: string } = {}) => {
  const pageName = propOverrides.pageName ?? 'members';
  const teamUid = propOverrides.teamUid ?? 'aaaaaa';
  (useParams as jest.Mock).mockReturnValue({ uid: `${teamUid}`, page: pageName });
  render(<TeamPages />);
};

describe('TeamPages', () => {
  it('should render settings and preferences page', async () => {
    setup({
      pageName: 'settings',
    });

    expect(await screen.findByText('Team settings')).toBeInTheDocument();
  });

  it('should render group sync page', async () => {
    setup({
      pageName: 'groupsync',
    });

    expect(await screen.findByText('Team group sync')).toBeInTheDocument();
  });
});
