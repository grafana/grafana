import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';
import { getSelectParent, selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render, screen, userEvent, waitFor, within, testWithFeatureToggles } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { captureRequests } from 'app/features/alerting/unified/mocks/server/events';

import { SharedPreferencesFunctional } from './SharedPreferencesFunctional';

setBackendSrv(backendSrv);
setupMockServer();

const getPrefsUpdateRequest = async (requests: Request[]) => {
  const prefsUpdate = requests.find((r) => r.url.match('/preferences') && r.method === 'PUT');

  return prefsUpdate!.clone().json();
};

const [_, { dashbdD, dashbdE }] = getFolderFixtures();

const selectComboboxOptionInTest = async (input: HTMLElement, optionOrOptions: string | RegExp) => {
  const user = userEvent.setup();
  await user.click(input);
  const option = await screen.findByRole('option', { name: optionOrOptions });
  await user.click(option);
};

const setup = async () => {
  const view = render(<SharedPreferencesFunctional resourceUri="user" preferenceType="user" />);
  const themeSelect = await screen.findByRole('combobox', { name: /Interface theme/ });
  await waitFor(() => expect(themeSelect).not.toBeDisabled());
  return view;
};

const mockReload = jest.fn();
const originalLocation = window.location;

testWithFeatureToggles({ enable: ['grafanaconThemes'] });

beforeAll(() => {
  jest.spyOn(window, 'location', 'get').mockReturnValue({ ...originalLocation, reload: mockReload });
  comboboxTestSetup();
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('SharedPreferencesFunctional', () => {
  it('renders the theme preference', async () => {
    await setup();
    const themeSelect = await screen.findByRole('combobox', { name: /Interface theme/ });
    await waitFor(() => expect(themeSelect).toHaveValue('Light'));
  });

  it('renders the home dashboard preference', async () => {
    await setup();
    const dashboardSelect = getSelectParent(screen.getByLabelText('Home Dashboard'));
    await waitFor(() => {
      expect(dashboardSelect).toHaveTextContent(dashbdD.item.title);
    });
  });

  it('renders the timezone preference', async () => {
    await setup();
    const tzSelect = getSelectParent(screen.getByLabelText('Timezone'));
    expect(tzSelect).toHaveTextContent('Browser Time');
  });

  it('renders the week start preference', async () => {
    await setup();
    const weekSelect = await screen.findByRole('combobox', { name: 'Week start' });
    expect(weekSelect).toHaveValue('Monday');
  });

  it('renders the default language preference', async () => {
    await setup();
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

  it('saves the users new preferences', async () => {
    const dashboardToSelect = dashbdE.item;
    const capture = captureRequests();
    const { user } = await setup();

    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: /Interface theme/ }), 'Dark');
    await selectComboboxOptionInTest(
      await screen.findByRole('combobox', { name: /home dashboard/i }),
      new RegExp(dashboardToSelect.title)
    );
    await selectOptionInTest(screen.getByLabelText('Timezone'), 'Sydney');
    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: 'Week start' }), 'Saturday');
    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: /language/i }), 'Français');

    await user.click(screen.getByText('Save preferences'));

    const requests = await capture;
    const newPreferences = await getPrefsUpdateRequest(requests);

    expect(newPreferences).toEqual({
      timezone: 'Australia/Sydney',
      weekStart: 'saturday',
      theme: 'dark',
      homeDashboardUID: dashboardToSelect.uid,
      queryHistory: { homeTab: '' },
      language: 'fr-FR',
      regionalFormat: '',
      navbar: { bookmarkUrls: [] },
    });
  });

  it('saves an experimental theme preference', async () => {
    const capture = captureRequests();
    const { user } = await setup();

    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: /Interface theme/ }), 'Sapphire dusk');

    await user.click(screen.getByText('Save preferences'));

    const requests = await capture;
    const newPreferences = await getPrefsUpdateRequest(requests);

    expect(newPreferences).toMatchObject({
      theme: 'sapphiredusk',
    });
  });

  it('saves the users default preferences', async () => {
    const capture = captureRequests();
    const { user } = await setup();
    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: /Interface theme/ }), 'Default');

    // there's no default option in this dropdown - there's a clear selection button
    // get the parent container, and find the "Clear value" button
    const dashboardSelect = screen.getByTestId('User preferences home dashboard drop down');
    await user.click(within(dashboardSelect).getByRole('button', { name: 'Clear value' }));

    await selectOptionInTest(screen.getByLabelText('Timezone'), 'Default');
    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: 'Week start' }), 'Default');
    await selectComboboxOptionInTest(screen.getByRole('combobox', { name: /language/i }), 'Default');

    await user.click(screen.getByText('Save preferences'));
    const requests = await capture;
    const newPreferences = await getPrefsUpdateRequest(requests);

    expect(newPreferences).toEqual({
      timezone: '',
      weekStart: '',
      theme: '',
      homeDashboardUID: '',
      queryHistory: { homeTab: '' },
      language: '',
      regionalFormat: '',
      navbar: { bookmarkUrls: [] },
    });
  });

  it('refreshes the page after saving preferences', async () => {
    const { user } = await setup();
    await user.click(screen.getByText('Save preferences'));
    expect(mockReload).toHaveBeenCalled();
  });
});
