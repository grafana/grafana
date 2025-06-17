import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { comboboxTestSetup } from 'test/helpers/comboboxTestSetup';
import { getSelectParent, selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { Preferences as UserPreferencesDTO } from '@grafana/schema/src/raw/preferences/x/preferences_types.gen';

import SharedPreferences from './SharedPreferences';

const selectComboboxOptionInTest = async (input: HTMLElement, optionOrOptions: string) => {
  await userEvent.click(input);
  const option = await screen.findByRole('option', { name: optionOrOptions });
  await userEvent.click(option);
};

jest.mock('app/features/dashboard/api/dashboard_api', () => ({
  getDashboardAPI: () => ({
    getDashboardDTO: jest.fn().mockResolvedValue({
      dashboard: {
        id: 2,
        title: 'My Dashboard',
        uid: 'myDash',
        templating: {
          list: [],
        },
        panels: [],
      },
      meta: {},
    }),
  }),
}));

jest.mock('app/core/services/backend_srv', () => {
  return {
    backendSrv: {
      search: jest.fn().mockResolvedValue([
        {
          id: 2,
          title: 'My Dashboard',
          tags: [],
          type: '',
          uid: 'myDash',
          uri: '',
          url: '',
          folderId: 0,
          folderTitle: '',
          folderUid: '',
          folderUrl: '',
          isStarred: true,
          slug: '',
          items: [],
        },
        {
          id: 3,
          title: 'Another Dashboard',
          tags: [],
          type: '',
          uid: 'anotherDash',
          uri: '',
          url: '',
          folderId: 0,
          folderTitle: '',
          folderUid: '',
          folderUrl: '',
          isStarred: true,
          slug: '',
          items: [],
        },
      ]),
    },
  };
});

const mockPreferences: UserPreferencesDTO = {
  timezone: 'browser',
  weekStart: 'monday',
  theme: 'light',
  homeDashboardUID: 'myDash',
  queryHistory: {
    homeTab: '',
  },
  language: '',
};

const defaultPreferences: UserPreferencesDTO = {
  timezone: '',
  weekStart: '',
  theme: '',
  homeDashboardUID: '',
  queryHistory: {
    homeTab: '',
  },
  language: '',
};

const mockPrefsPatch = jest.fn().mockResolvedValue(undefined);
const mockPrefsUpdate = jest.fn().mockResolvedValue(undefined);
const mockPrefsLoad = jest.fn().mockResolvedValue(mockPreferences);

jest.mock('app/core/services/PreferencesService', () => ({
  PreferencesService: function () {
    return {
      patch: mockPrefsPatch,
      update: mockPrefsUpdate,
      load: mockPrefsLoad,
    };
  },
}));

const props = {
  resourceUri: '/fake-api/user/1',
  preferenceType: 'user' as const,
};

describe('SharedPreferences', () => {
  const original = window.location;
  const mockReload = jest.fn();

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: mockReload },
    });
    comboboxTestSetup();
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  beforeEach(async () => {
    render(<SharedPreferences {...props} />);

    await waitFor(() => expect(mockPrefsLoad).toHaveBeenCalled());
  });

  it('renders the theme preference', async () => {
    const themeSelect = await screen.findByRole('combobox', { name: 'Interface theme' });
    expect(themeSelect).toHaveValue('Light');
  });

  it('renders the home dashboard preference', async () => {
    const dashboardSelect = getSelectParent(screen.getByLabelText('Home Dashboard'));
    await waitFor(() => {
      expect(dashboardSelect).toHaveTextContent('My Dashboard');
    });
  });

  it('renders the timezone preference', () => {
    const tzSelect = getSelectParent(screen.getByLabelText('Timezone'));
    expect(tzSelect).toHaveTextContent('Browser Time');
  });

  it('renders the week start preference', async () => {
    const weekSelect = await screen.findByRole('combobox', { name: 'Week start' });
    expect(weekSelect).toHaveValue('Monday');
  });

  it('renders the default language preference', async () => {
    const langSelect = await screen.findByRole('combobox', { name: /language/i });
    expect(langSelect).toHaveValue('Default');
  });

  it('does not render the pseudo-locale', async () => {
    const langSelect = await screen.findByRole('combobox', { name: /language/i });

    // Open the combobox and wait for the options to be rendered
    await userEvent.click(langSelect);

    // TODO: The input value should be cleared when clicked, but for some reason it's not?
    // checking langSelect.value beforehand indicates that it is cleared, but after using
    // userEvent.type the default value comes back?
    await userEvent.type(
      langSelect,
      '{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}Pseudo'
    );

    const option = screen.queryByRole('option', { name: 'Pseudo-locale' });
    expect(option).not.toBeInTheDocument();
  });

  it('saves the users new preferences', async () => {
    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: 'Interface theme' }), 'Dark');
    await selectOptionInTest(screen.getByLabelText('Timezone'), 'Australia/Sydney');
    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: 'Week start' }), 'Saturday');
    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: /language/i }), 'Français');

    await userEvent.click(screen.getByText('Save'));

    expect(mockPrefsUpdate).toHaveBeenCalledWith({
      timezone: 'Australia/Sydney',
      weekStart: 'saturday',
      theme: 'dark',
      homeDashboardUID: 'myDash',
      queryHistory: {
        homeTab: '',
      },
      language: 'fr-FR',
    });
  });

  it('saves the users default preferences', async () => {
    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: 'Interface theme' }), 'Default');

    // there's no default option in this dropdown - there's a clear selection button
    // get the parent container, and find the "Clear value" button
    const dashboardSelect = screen.getByTestId('User preferences home dashboard drop down');
    await userEvent.click(within(dashboardSelect).getByRole('button', { name: 'Clear value' }));

    await selectOptionInTest(screen.getByLabelText('Timezone'), 'Default');

    await selectComboboxOptionInTest(await screen.findByRole('combobox', { name: 'Week start' }), 'Default');

    await selectComboboxOptionInTest(screen.getByRole('combobox', { name: /language/i }), 'Default');

    await userEvent.click(screen.getByText('Save'));
    expect(mockPrefsUpdate).toHaveBeenCalledWith(defaultPreferences);
  });

  it('refreshes the page after saving preferences', async () => {
    await userEvent.click(screen.getByText('Save'));
    expect(mockReload).toHaveBeenCalled();
  });
});
