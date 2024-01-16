import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { getSelectParent, selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { Preferences as UserPreferencesDTO } from '@grafana/schema/src/raw/preferences/x/preferences_types.gen';

import SharedPreferences from './SharedPreferences';

jest.mock('app/core/services/backend_srv', () => {
  return {
    backendSrv: {
      getDashboardByUid: jest.fn().mockResolvedValue({
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

const mockPrefsPatch = jest.fn();
const mockPrefsUpdate = jest.fn();
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
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  beforeEach(async () => {
    mockReload.mockReset();
    mockPrefsUpdate.mockReset();

    render(<SharedPreferences {...props} />);

    await waitFor(() => expect(mockPrefsLoad).toHaveBeenCalled());
  });

  it('renders the theme preference', () => {
    const themeSelect = getSelectParent(screen.getByLabelText('Interface theme'));
    expect(themeSelect).toHaveTextContent('Light');
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
    const weekSelect = getSelectParent(screen.getByLabelText('Week start'));
    expect(weekSelect).toHaveTextContent('Monday');
  });

  it('renders the language preference', async () => {
    const weekSelect = getSelectParent(screen.getByLabelText(/language/i));
    expect(weekSelect).toHaveTextContent('Default');
  });

  it('saves the users new preferences', async () => {
    await selectOptionInTest(screen.getByLabelText('Interface theme'), 'Dark');
    await selectOptionInTest(screen.getByLabelText('Timezone'), 'Australia/Sydney');
    await selectOptionInTest(screen.getByLabelText('Week start'), 'Saturday');
    await selectOptionInTest(screen.getByLabelText(/language/i), 'Français');

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
    await selectOptionInTest(screen.getByLabelText('Interface theme'), 'Default');

    // there's no default option in this dropdown - there's a clear selection button
    // get the parent container, and find the "select-clear-value" button
    const dashboardSelect = screen.getByTestId('User preferences home dashboard drop down');
    await userEvent.click(within(dashboardSelect).getByRole('button', { name: 'select-clear-value' }));

    await selectOptionInTest(screen.getByLabelText('Timezone'), 'Default');
    await selectOptionInTest(screen.getByLabelText('Week start'), 'Default');
    await selectOptionInTest(screen.getByLabelText(/language/i), 'Default');

    await userEvent.click(screen.getByText('Save'));
    expect(mockPrefsUpdate).toHaveBeenCalledWith(defaultPreferences);
  });

  it('refreshes the page after saving preferences', async () => {
    await userEvent.click(screen.getByText('Save'));
    expect(mockReload).toHaveBeenCalled();
  });
});
