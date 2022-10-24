import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import TestProvider from 'test/helpers/TestProvider';
import { assertInstanceOf } from 'test/helpers/asserts';
import { getSelectParent, selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { UserPreferencesDTO } from 'app/types';

import SharedPreferences from './SharedPreferences';

jest.mock('@grafana/runtime', () => {
  const originalModule = jest.requireActual('@grafana/runtime');
  return {
    ...originalModule,
    config: {
      ...originalModule.config,
      featureToggles: {
        internationalization: true,
      },
    },
  };
});

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
  locale: '',
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

    render(
      <TestProvider>
        <SharedPreferences {...props} />
      </TestProvider>
    );

    await waitFor(() => expect(mockPrefsLoad).toHaveBeenCalled());
  });

  it('renders the theme preference', () => {
    const lightThemeRadio = assertInstanceOf(screen.getByLabelText('Light'), HTMLInputElement);
    expect(lightThemeRadio.checked).toBeTruthy();
  });

  it('renders the home dashboard preference', () => {
    const dashboardSelect = getSelectParent(screen.getByLabelText('Home Dashboard'));
    expect(dashboardSelect).toHaveTextContent('My Dashboard');
  });

  it('renders the timezone preference', () => {
    const tzSelect = getSelectParent(screen.getByLabelText('Timezone'));
    expect(tzSelect).toHaveTextContent('Browser Time');
  });

  it('renders the week start preference', async () => {
    const weekSelect = getSelectParent(screen.getByLabelText('Week start'));
    expect(weekSelect).toHaveTextContent('Monday');
  });

  it('renders the locale preference', async () => {
    const weekSelect = getSelectParent(screen.getByLabelText(/language/i));
    expect(weekSelect).toHaveTextContent('Default');
  });

  it("saves the user's new preferences", async () => {
    const darkThemeRadio = assertInstanceOf(screen.getByLabelText('Dark'), HTMLInputElement);
    await userEvent.click(darkThemeRadio);

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
      locale: 'fr-FR',
    });
  });

  it("saves the user's default preferences", async () => {
    const defThemeRadio = assertInstanceOf(screen.getByLabelText('Default'), HTMLInputElement);
    await userEvent.click(defThemeRadio);

    await selectOptionInTest(screen.getByLabelText('Home Dashboard'), 'Default');
    await selectOptionInTest(screen.getByLabelText('Timezone'), 'Default');
    await selectOptionInTest(screen.getByLabelText('Week start'), 'Default');
    await selectOptionInTest(screen.getByLabelText(/language/i), 'Default');

    await userEvent.click(screen.getByText('Save'));
    expect(mockPrefsUpdate).toHaveBeenCalledWith({
      timezone: 'browser',
      weekStart: '',
      theme: '',
      homeDashboardUID: 'myDash',
      queryHistory: {
        homeTab: '',
      },
      locale: '',
    });
  });

  it('refreshes the page after saving preferences', async () => {
    await userEvent.click(screen.getByText('Save'));
    expect(mockReload).toHaveBeenCalled();
  });
});
