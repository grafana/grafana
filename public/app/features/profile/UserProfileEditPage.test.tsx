import { within } from '@testing-library/dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';

import { OrgRole } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { TestProvider } from '../../../test/helpers/TestProvider';
import { backendSrv } from '../../core/services/backend_srv';
import { TeamPermissionLevel } from '../../types';
import { getMockTeam } from '../teams/__mocks__/teamMocks';

import { Props, UserProfileEditPage } from './UserProfileEditPage';
import { initialUserState } from './state/reducers';

const defaultProps: Props = {
  ...initialUserState,
  user: {
    id: 1,
    name: 'Test User',
    email: 'test@test.com',
    login: 'test',
    isDisabled: false,
    isGrafanaAdmin: false,
    orgId: 0,
  },
  teams: [
    getMockTeam(0, {
      name: 'Team One',
      email: 'team.one@test.com',
      avatarUrl: '/avatar/07d881f402480a2a511a9a15b5fa82c0',
      memberCount: 2000,
      permission: TeamPermissionLevel.Admin,
    }),
  ],
  orgs: [
    {
      name: 'Main',
      orgId: 0,
      role: OrgRole.Editor,
    },
    {
      name: 'Second',
      orgId: 1,
      role: OrgRole.Viewer,
    },
    {
      name: 'Third',
      orgId: 2,
      role: OrgRole.Admin,
    },
  ],
  sessions: [
    {
      id: 0,
      browser: 'Chrome',
      browserVersion: '90',
      clientIp: 'localhost',
      createdAt: '2021-01-01 04:00:00',
      device: 'Macbook Pro',
      isActive: true,
      os: 'Mac OS X',
      osVersion: '11',
      seenAt: new Date().toUTCString(),
    },
  ],
  initUserProfilePage: jest.fn().mockResolvedValue(undefined),
  revokeUserSession: jest.fn().mockResolvedValue(undefined),
  changeUserOrg: jest.fn().mockResolvedValue(undefined),
  updateUserProfile: jest.fn().mockResolvedValue(undefined),
};

function getSelectors() {
  const teamsTable = () => screen.getByRole('table', { name: /user teams table/i });
  const orgsTable = () => screen.getByTestId(selectors.components.UserProfile.orgsTable);
  const sessionsTable = () => screen.getByTestId(selectors.components.UserProfile.sessionsTable);
  return {
    name: () => screen.getByRole('textbox', { name: /^name$/i }),
    email: () => screen.getByRole('textbox', { name: /email/i }),
    username: () => screen.getByRole('textbox', { name: /username/i }),
    saveProfile: () => screen.getByTestId(selectors.components.UserProfile.profileSaveButton),
    savePreferences: () => screen.getByTestId(selectors.components.UserProfile.preferencesSaveButton),
    teamsTable,
    teamsRow: () => within(teamsTable()).getByRole('row', { name: /team one team.one@test\.com 2000/i }),
    orgsTable,
    orgsEditorRow: () => within(orgsTable()).getByRole('row', { name: /main editor current/i }),
    orgsViewerRow: () => within(orgsTable()).getByRole('row', { name: /second viewer select organisation/i }),
    orgsAdminRow: () => within(orgsTable()).getByRole('row', { name: /third admin select organisation/i }),
    sessionsTable,
    sessionsRow: () =>
      within(sessionsTable()).getByRole('row', {
        name: /now January 1, 2021 localhost chrome on mac os x 11/i,
      }),
  };
}

async function getTestContext(overrides: Partial<Props> = {}) {
  jest.clearAllMocks();
  const putSpy = jest.spyOn(backendSrv, 'put');
  const getSpy = jest
    .spyOn(backendSrv, 'get')
    .mockResolvedValue({ timezone: 'UTC', homeDashboardUID: 'home-dashboard', theme: 'dark' });
  const searchSpy = jest.spyOn(backendSrv, 'search').mockResolvedValue([]);

  const props = { ...defaultProps, ...overrides };
  const { rerender } = render(
    <TestProvider>
      <UserProfileEditPage {...props} />
    </TestProvider>
  );

  await waitFor(() => expect(props.initUserProfilePage).toHaveBeenCalledTimes(1));

  return { rerender, putSpy, getSpy, searchSpy, props };
}

describe('UserProfileEditPage', () => {
  describe('when loading user', () => {
    it('should show loading placeholder', async () => {
      await getTestContext({ user: null });

      expect(screen.getByText(/loading \.\.\./i)).toBeInTheDocument();
    });
  });

  describe('when user has loaded', () => {
    it('should show profile form', async () => {
      await getTestContext();

      const { name, email, username, saveProfile } = getSelectors();
      expect(name()).toBeInTheDocument();
      expect(name()).toHaveValue('Test User');
      expect(email()).toBeInTheDocument();
      expect(email()).toHaveValue('test@test.com');
      expect(username()).toBeInTheDocument();
      expect(username()).toHaveValue('test');
      expect(saveProfile()).toBeInTheDocument();
    });

    it('should show shared preferences', async () => {
      await getTestContext();

      // SharedPreferences itself is tested, so here just make sure it's being rendered
      expect(screen.getByLabelText('Home Dashboard')).toBeInTheDocument();
    });

    describe('and teams are loading', () => {
      it('should show teams loading placeholder', async () => {
        await getTestContext({ teamsAreLoading: true });

        expect(screen.getByText(/loading teams\.\.\./i)).toBeInTheDocument();
      });
    });

    describe('and teams are loaded', () => {
      it('should show teams', async () => {
        await getTestContext();

        const { teamsTable, teamsRow } = getSelectors();
        expect(screen.getByRole('heading', { name: /teams/i })).toBeInTheDocument();
        expect(teamsTable()).toBeInTheDocument();
        expect(teamsRow()).toBeInTheDocument();
      });
    });

    describe('and organizations are loading', () => {
      it('should show teams loading placeholder', async () => {
        await getTestContext({ orgsAreLoading: true });

        expect(screen.getByText(/loading organizations\.\.\./i)).toBeInTheDocument();
      });
    });

    describe('and organizations are loaded', () => {
      it('should show organizations', async () => {
        await getTestContext();

        const { orgsTable, orgsEditorRow, orgsViewerRow, orgsAdminRow } = getSelectors();
        expect(screen.getByRole('heading', { name: /organizations/i })).toBeInTheDocument();
        expect(orgsTable()).toBeInTheDocument();
        expect(orgsEditorRow()).toBeInTheDocument();
        expect(orgsViewerRow()).toBeInTheDocument();
        expect(orgsAdminRow()).toBeInTheDocument();
      });
    });

    describe('and sessions are loading', () => {
      it('should show teams loading placeholder', async () => {
        await getTestContext({ sessionsAreLoading: true });

        expect(screen.getByText(/loading sessions\.\.\./i)).toBeInTheDocument();
      });
    });

    describe('and sessions are loaded', () => {
      it('should show sessions', async () => {
        await getTestContext();

        const { sessionsTable, sessionsRow } = getSelectors();
        expect(sessionsTable()).toBeInTheDocument();
        expect(sessionsRow()).toBeInTheDocument();
      });
    });

    describe('and user is edited and saved', () => {
      it('should call updateUserProfile', async () => {
        const { props } = await getTestContext();

        const { email, saveProfile } = getSelectors();
        await userEvent.clear(email());
        await userEvent.type(email(), 'test@test.se');
        // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
        await userEvent.click(saveProfile(), { pointerEventsCheck: PointerEventsCheckLevel.Never });

        await waitFor(() => expect(props.updateUserProfile).toHaveBeenCalledTimes(1));
        expect(props.updateUserProfile).toHaveBeenCalledWith({
          email: 'test@test.se',
          login: 'test',
          name: 'Test User',
        });
      });
    });

    describe('and organization is changed', () => {
      it('should call changeUserOrg', async () => {
        const { props } = await getTestContext();
        const orgsAdminSelectButton = () =>
          within(getSelectors().orgsAdminRow()).getByRole('button', {
            name: /select organisation/i,
          });

        await userEvent.click(orgsAdminSelectButton());

        await waitFor(() => expect(props.changeUserOrg).toHaveBeenCalledTimes(1));
        expect(props.changeUserOrg).toHaveBeenCalledWith({
          name: 'Third',
          orgId: 2,
          role: 'Admin',
        });
      });
    });

    describe('and session is revoked', () => {
      it('should call revokeUserSession', async () => {
        const { props } = await getTestContext();
        const sessionsRevokeButton = () =>
          within(getSelectors().sessionsRow()).getByRole('button', {
            name: /revoke user session/i,
          });

        await userEvent.click(sessionsRevokeButton());

        await waitFor(() => expect(props.revokeUserSession).toHaveBeenCalledTimes(1));
        expect(props.revokeUserSession).toHaveBeenCalledWith(0);
      });
    });
  });
});
