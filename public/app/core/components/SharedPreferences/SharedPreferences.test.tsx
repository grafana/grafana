import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import TestProvider from 'test/helpers/TestProvider';
import { assertInstanceOf } from 'test/helpers/asserts';
import { getSelectParent, selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { UserPreferencesDTO } from 'app/types';

import SharedPreferences from './SharedPreferences';

jest.mock('app/core/services/backend_srv', () => {
  return {
    backendSrv: {
      search: jest.fn().mockResolvedValue([
        {
          id: 2,
          title: 'My Dashboard',
          tags: [],
          type: '',
          uid: '',
          uri: '',
          url: '',
          folderId: 0,
          folderTitle: '',
          folderUid: '',
          folderUrl: '',
          isStarred: false,
          slug: '',
          items: [],
        },
        {
          id: 3,
          title: 'Another Dashboard',
          tags: [],
          type: '',
          uid: '',
          uri: '',
          url: '',
          folderId: 0,
          folderTitle: '',
          folderUid: '',
          folderUrl: '',
          isStarred: false,
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
  homeDashboardId: 2,
  queryHistory: {
    homeTab: '',
  },
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

  it("saves the user's new preferences", async () => {
    const darkThemeRadio = assertInstanceOf(screen.getByLabelText('Dark'), HTMLInputElement);
    await userEvent.click(darkThemeRadio);

    await selectOptionInTest(screen.getByLabelText('Home Dashboard'), 'Another Dashboard');
    await selectOptionInTest(screen.getByLabelText('Timezone'), 'Australia/Sydney');
    await selectOptionInTest(screen.getByLabelText('Week start'), 'Saturday');

    await userEvent.click(screen.getByText('Save'));
    expect(mockPrefsUpdate).toHaveBeenCalledWith({
      timezone: 'Australia/Sydney',
      weekStart: 'saturday',
      theme: 'dark',
      homeDashboardId: 3,
      queryHistory: {
        homeTab: '',
      },
    });
  });

  it('refreshes the page after saving preferences', async () => {
    await userEvent.click(screen.getByText('Save'));
    expect(mockReload).toHaveBeenCalled();
  });
});
