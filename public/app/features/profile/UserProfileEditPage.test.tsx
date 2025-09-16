import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { type ComponentTypeWithExtensionMeta, OrgRole } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setPluginComponentsHook, usePluginComponents } from '@grafana/runtime';

import { backendSrv } from '../../core/services/backend_srv';
import { createComponentWithMeta } from '../plugins/extensions/usePluginComponents';
import { getMockTeam } from '../teams/mocks/teamMocks';

import { Props, UserProfileEditPage } from './UserProfileEditPage';
import { initialUserState } from './state/reducers';

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () => ({
    getDashboardDTO: jest.fn().mockResolvedValue({}),
  }),
}));

const defaultProps: Props = {
  ...initialUserState,
  user: {
    id: 1,
    uid: 'aaaaaa',
    name: 'Test User',
    email: 'test@test.com',
    login: 'test',
    isDisabled: false,
    isGrafanaAdmin: false,
    orgId: 0,
  },
  teams: [
    getMockTeam(0, 'aaaaaa', {
      name: 'Team One',
      email: 'team.one@test.com',
      avatarUrl: '/avatar/07d881f402480a2a511a9a15b5fa82c0',
      memberCount: 2000,
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
    /**
     * using queryByTestId instead of getByTestId because the tabs are not always rendered
     * and getByTestId throws an TestingLibraryElementError error if the element is not found
     * whereas queryByTestId returns null if the element is not found. There are some test cases
     * where we'd explicitly like to assert that the tabs are not rendered.
     */
    extensionPointTabs: () => screen.queryByTestId(selectors.components.UserProfile.extensionPointTabs),
    /**
     * here lets use getByTestId because a specific tab should always be rendered within the tabs container
     */
    extensionPointTab: (tabId: string) =>
      within(screen.getByTestId(selectors.components.UserProfile.extensionPointTabs)).getByTestId(
        selectors.components.UserProfile.extensionPointTab(tabId)
      ),
  };
}

enum ExtensionPointComponentId {
  One = '1',
  Two = '2',
  Three = '3',
}

enum ExtensionPointComponentTabs {
  One = '1',
  Two = '2',
}

const _createTabName = (tab: ExtensionPointComponentTabs) => tab;
const _createTabContent = (tabId: ExtensionPointComponentId) => `this is settings for component ${tabId}`;

const generalTabName = 'General';
const generalTestId = 'user-profile-edit-page';
const tabOneName = _createTabName(ExtensionPointComponentTabs.One);
const tabTwoName = _createTabName(ExtensionPointComponentTabs.Two);

const _createPluginExtensionPointComponent = (
  id: ExtensionPointComponentId,
  tab: ExtensionPointComponentTabs
): ComponentTypeWithExtensionMeta =>
  createComponentWithMeta<{}>(
    {
      title: _createTabName(tab),
      description: '', // description isn't used here..
      component: () => <p>{_createTabContent(id)}</p>,
      pluginId: 'grafana-plugin',
    },
    id
  );

const PluginExtensionPointComponent1 = _createPluginExtensionPointComponent(
  ExtensionPointComponentId.One,
  ExtensionPointComponentTabs.One
);
const PluginExtensionPointComponent2 = _createPluginExtensionPointComponent(
  ExtensionPointComponentId.Two,
  ExtensionPointComponentTabs.One
);
const PluginExtensionPointComponent3 = _createPluginExtensionPointComponent(
  ExtensionPointComponentId.Three,
  ExtensionPointComponentTabs.Two
);

async function getTestContext(overrides: Partial<Props & { components: ComponentTypeWithExtensionMeta[] }> = {}) {
  const components = overrides.components || [];

  jest.clearAllMocks();
  const putSpy = jest.spyOn(backendSrv, 'put');
  const getSpy = jest
    .spyOn(backendSrv, 'get')
    .mockResolvedValue({ timezone: 'UTC', homeDashboardUID: 'home-dashboard', theme: 'dark' });
  const searchSpy = jest.spyOn(backendSrv, 'search').mockResolvedValue([]);

  const getter: typeof usePluginComponents = jest.fn().mockReturnValue({ components, isLoading: false });

  setPluginComponentsHook(getter);

  const props = { ...defaultProps, ...overrides };
  const { rerender } = render(<UserProfileEditPage {...props} />);

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

    describe('and a plugin registers a component against the user profile settings extension point', () => {
      const components = [
        PluginExtensionPointComponent1,
        PluginExtensionPointComponent2,
        PluginExtensionPointComponent3,
      ];

      it('should not show tabs when no components are registered', async () => {
        await getTestContext();
        const { extensionPointTabs } = getSelectors();
        expect(extensionPointTabs()).not.toBeInTheDocument();
      });

      it('should group registered components into tabs', async () => {
        await getTestContext({ components });
        const { extensionPointTabs, extensionPointTab } = getSelectors();

        const _assertTab = (tabId: string, isDefault = false) => {
          const tab = extensionPointTab(tabId);
          expect(tab).toBeInTheDocument();
          expect(tab).toHaveAttribute('aria-selected', isDefault.toString());
        };

        expect(extensionPointTabs()).toBeInTheDocument();
        _assertTab(generalTabName.toLowerCase(), true);
        _assertTab(tabOneName.toLowerCase());
        _assertTab(tabTwoName.toLowerCase());
      });

      it('should change the active tab when a tab is clicked and update the "tab" query param', async () => {
        await getTestContext({ components });
        const { extensionPointTab } = getSelectors();

        /**
         * Tab one has two extension components registered against it, they'll both be registered in the same tab
         * Tab two only has one extension component registered against it.
         */
        const tabOneContent1 = _createTabContent(ExtensionPointComponentId.One);
        const tabOneContent2 = _createTabContent(ExtensionPointComponentId.Two);
        const tabTwoContent = _createTabContent(ExtensionPointComponentId.Three);

        // "General" should be the default content
        expect(screen.queryByTestId(generalTestId)).toBeInTheDocument();
        expect(screen.queryByText(tabOneContent1)).toBeNull();
        expect(screen.queryByText(tabOneContent2)).toBeNull();
        expect(screen.queryByText(tabTwoContent)).toBeNull();

        await userEvent.click(extensionPointTab(tabOneName.toLowerCase()));

        expect(screen.queryByTestId(generalTestId)).toBeNull();
        expect(screen.queryByText(tabOneContent1)).toBeInTheDocument();
        expect(screen.queryByText(tabOneContent2)).toBeInTheDocument();
        expect(screen.queryByText(tabTwoContent)).toBeNull();

        await userEvent.click(extensionPointTab(tabTwoName.toLowerCase()));

        expect(screen.queryByTestId(generalTestId)).toBeNull();
        expect(screen.queryByText(tabOneContent1)).toBeNull();
        expect(screen.queryByText(tabOneContent2)).toBeNull();
        expect(screen.queryByText(tabTwoContent)).toBeInTheDocument();
      });
    });
  });
});
