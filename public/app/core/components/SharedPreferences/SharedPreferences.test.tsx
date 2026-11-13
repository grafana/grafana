import { HttpResponse } from 'msw';
import { getSelectParent, selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { mockComboboxRect } from '@grafana/test-utils';
import { preferencesHandlers } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';

import { SharedPreferences } from './SharedPreferences';
import { homeDashboardChanged } from './analytics/main';
import { GLOBAL_HOME_DASHBOARD_UID } from './utils';

jest.mock('./analytics/main', () => ({
  saveButtonClicked: jest.fn(),
  themeChanged: jest.fn(),
  languageChanged: jest.fn(),
  homeDashboardChanged: jest.fn(),
}));

setBackendSrv(backendSrv);
setupMockServer();

const getPrefsUpdateRequest = async (requests: Request[]) => {
  const prefsUpdate = await waitFor(() => {
    const request = requests.find((r) => r.url.match('/preferences') && r.method === 'PATCH');
    expect(request).toBeDefined();
    return request!;
  });
  return prefsUpdate.clone().json();
};

const [_, { dashbdD, dashbdE }] = getFolderFixtures();

const selectComboboxOptionInTest = async (
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLElement,
  optionOrOptions: string | RegExp,
  filterText?: string
) => {
  await user.click(input);
  if (filterText) {
    await user.type(input, filterText, { skipClick: true });
  }
  const option = await screen.findByRole('option', { name: optionOrOptions });
  await user.click(option);
};

const setup = async () => {
  const view = render(<SharedPreferences resourceUri="user" preferenceType="user" legend="Preferences" />);
  const themeSelect = await screen.findByRole('combobox', { name: /Interface theme/ });
  await waitFor(() => expect(themeSelect).not.toBeDisabled());
  return { ...view, themeSelect };
};

const mockReload = jest.fn();
const originalLocation = window.location;

beforeEach(() => {
  mockReload.mockClear();
  jest.mocked(homeDashboardChanged).mockClear();
});

beforeAll(() => {
  jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...originalLocation,
    // Location URL properties can be prototype accessors rather than own properties.
    href: originalLocation.href,
    origin: originalLocation.origin,
    protocol: originalLocation.protocol,
    host: originalLocation.host,
    hostname: originalLocation.hostname,
    port: originalLocation.port,
    pathname: originalLocation.pathname,
    search: originalLocation.search,
    hash: originalLocation.hash,
    reload: mockReload,
  });
  mockComboboxRect();
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('SharedPreferences', () => {
  it('renders the loaded theme, home dashboard, timezone, week start, and default language preferences', async () => {
    const { themeSelect } = await setup();
    await waitFor(() => expect(themeSelect).toHaveValue('Light'));

    const dashboardSelect = getSelectParent(screen.getByLabelText('Home Dashboard'));
    await waitFor(() => {
      expect(dashboardSelect).toHaveTextContent(dashbdD.item.title);
    });

    const tzSelect = getSelectParent(screen.getByLabelText('Timezone'));
    expect(tzSelect).toHaveTextContent('Browser Time');

    const weekSelect = await screen.findByRole('combobox', { name: 'Week start' });
    await waitFor(() => expect(weekSelect).toHaveValue('Monday'));

    const langSelect = await screen.findByRole('combobox', { name: /language/i });
    expect(langSelect).toHaveValue('Default');
  });

  it('does not render the pseudo-locale', async () => {
    const { user } = await setup();
    const langSelect = await screen.findByRole('combobox', { name: /language/i });

    // Open the combobox and wait for the options to be rendered
    await user.click(langSelect);
    expect((await screen.findAllByRole('option'))[0]).toBeInTheDocument();

    await user.clear(langSelect);
    await user.type(langSelect, 'Pseudo', {
      // Don't click on the element again when typing as this would just re-set the value
      skipClick: true,
    });

    const option = screen.queryByRole('option', { name: 'Pseudo-locale' });
    expect(option).not.toBeInTheDocument();
  });

  it('saves the users new preferences and reports the home dashboard as set', async () => {
    const dashboardToSelect = dashbdE.item;
    const capture = captureRequests();
    const { user, themeSelect } = await setup();

    await selectComboboxOptionInTest(user, themeSelect, 'Dark');
    await selectComboboxOptionInTest(
      user,
      await screen.findByRole('combobox', { name: /home dashboard/i }),
      new RegExp(dashboardToSelect.title)
    );
    await selectOptionInTest(screen.getByLabelText('Timezone'), 'Sydney');
    await selectComboboxOptionInTest(user, await screen.findByRole('combobox', { name: 'Week start' }), 'Saturday');
    await selectComboboxOptionInTest(user, await screen.findByRole('combobox', { name: /language/i }), 'Français');

    await user.click(screen.getByRole('button', { name: 'Save preferences' }));

    const requests = await capture;
    const newPreferences = await getPrefsUpdateRequest(requests);

    expect(newPreferences).toEqual({
      spec: {
        timezone: 'Australia/Sydney',
        weekStart: 'saturday',
        theme: 'dark',
        homeDashboardUID: dashboardToSelect.uid,
        queryHistory: { homeTab: '' },
        language: 'fr-FR',
        navbar: { bookmarkUrls: [] },
      },
    });
    await waitFor(() => {
      expect(jest.mocked(homeDashboardChanged)).toHaveBeenCalledWith({
        preferenceType: 'user',
        action: 'set',
      });
    });
  });

  it('saves an experimental theme preference', async () => {
    const capture = captureRequests();
    const { user, themeSelect } = await setup();

    await selectComboboxOptionInTest(user, themeSelect, 'Gilded grove', 'Gilded');

    await user.click(screen.getByRole('button', { name: 'Save preferences' }));

    const requests = await capture;
    const newPreferences = await getPrefsUpdateRequest(requests);

    expect(newPreferences).toMatchObject({
      spec: { theme: 'gildedgrove' },
    });
  });

  it('saves the users default preferences and reports the home dashboard as cleared', async () => {
    const capture = captureRequests();
    const { user, themeSelect } = await setup();
    await selectComboboxOptionInTest(user, themeSelect, 'Default');

    // The Clear value button only renders once the loaded dashboard (dashbdD) resolves, so awaiting it
    // guarantees a non-empty starting value to clear.
    const dashboardSelect = screen.getByTestId('User preferences home dashboard drop down');
    await user.click(await within(dashboardSelect).findByRole('button', { name: 'Clear value' }));

    await selectOptionInTest(screen.getByLabelText('Timezone'), 'Default');
    await selectComboboxOptionInTest(user, await screen.findByRole('combobox', { name: 'Week start' }), 'Default');
    await selectComboboxOptionInTest(user, screen.getByRole('combobox', { name: /language/i }), 'Default');

    await user.click(screen.getByRole('button', { name: 'Save preferences' }));
    const requests = await capture;
    const newPreferences = await getPrefsUpdateRequest(requests);

    expect(newPreferences).toEqual({
      spec: {
        timezone: '',
        weekStart: '',
        theme: '',
        homeDashboardUID: '',
        queryHistory: { homeTab: '' },
        language: '',
        navbar: { bookmarkUrls: [] },
      },
    });
    await waitFor(() => {
      expect(jest.mocked(homeDashboardChanged)).toHaveBeenCalledWith({
        preferenceType: 'user',
        action: 'cleared',
      });
    });
  });

  it('refreshes the page after saving preferences', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));
    await waitFor(() => expect(mockReload).toHaveBeenCalled());
  });
  it('shows an error alert when preferences fail to load', async () => {
    server.use(
      preferencesHandlers.listPreferencesHandler(HttpResponse.json({ message: 'Server error' }, { status: 500 }))
    );
    render(<SharedPreferences resourceUri="user" preferenceType="user" legend="Preferences" />);
    expect(await screen.findByText('Error loading preferences')).toBeInTheDocument();
  });
  it('shows an error alert when saving preferences fails', async () => {
    server.use(
      preferencesHandlers.updatePreferencesHandler(HttpResponse.json({ message: 'Server error' }, { status: 500 }))
    );
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));

    expect(await screen.findByText('Error updating preferences')).toBeInTheDocument();
  });
  it('does not save when onConfirm returns false', async () => {
    const onConfirm = jest.fn().mockResolvedValue(false);
    const capture = captureRequests((r) => r.url.includes('/preferences') && r.method === 'PATCH');

    const { user } = render(
      <SharedPreferences resourceUri="user" preferenceType="user" onConfirm={onConfirm} legend="Preferences" />
    );
    const themeSelect = await screen.findByRole('combobox', { name: /Interface theme/ });
    await waitFor(() => expect(themeSelect).not.toBeDisabled());

    await user.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    const requests = await capture;
    expect(requests).toHaveLength(0);
    expect(mockReload).not.toHaveBeenCalled();
  });
  it('renders all form fields as disabled when disabled prop is true', async () => {
    render(<SharedPreferences resourceUri="user" preferenceType="user" disabled legend="Preferences" />);
    const themeSelect = await screen.findByRole('combobox', { name: /Interface theme/ });
    await waitFor(() => expect(themeSelect).toBeDisabled());

    expect(screen.getByRole('button', { name: 'Save preferences' })).not.toBeDisabled();
  });

  it('does not fire home_dashboard_changed when the home dashboard is unchanged', async () => {
    const { user } = await setup();

    await selectComboboxOptionInTest(user, screen.getByRole('combobox', { name: 'Week start' }), 'Saturday');
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() => expect(mockReload).toHaveBeenCalled());
    expect(jest.mocked(homeDashboardChanged)).not.toHaveBeenCalled();
  });

  it('lists Grafana home first, saves the sentinel, and reports set_global_home when selected', async () => {
    const capture = captureRequests();
    const { user } = await setup();

    const combobox = await screen.findByRole('combobox', { name: /home dashboard/i });
    await user.click(combobox);
    const options = await screen.findAllByRole('option');
    expect(options[0]).toHaveTextContent('Grafana home');
    await user.click(options[0]);

    await user.click(screen.getByRole('button', { name: 'Save preferences' }));

    const requests = await capture;
    const newPreferences = await getPrefsUpdateRequest(requests);
    expect(newPreferences).toMatchObject({
      spec: { homeDashboardUID: GLOBAL_HOME_DASHBOARD_UID },
    });
    await waitFor(() => {
      expect(jest.mocked(homeDashboardChanged)).toHaveBeenCalledWith({
        preferenceType: 'user',
        action: 'set_global_home',
      });
    });
  });

  it('renders Grafana home when the stored preference is the sentinel', async () => {
    server.use(
      preferencesHandlers.listPreferencesHandler(
        HttpResponse.json({
          metadata: {},
          items: [{ metadata: { name: 'user' }, spec: { homeDashboardUID: GLOBAL_HOME_DASHBOARD_UID } }],
        })
      )
    );

    await setup();

    const dashboardSelect = getSelectParent(screen.getByLabelText('Home Dashboard'));
    await waitFor(() => {
      expect(dashboardSelect).toHaveTextContent('Grafana home');
    });
  });
});
