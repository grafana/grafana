import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { waitFor } from 'test/test-utils';

import { Messages } from 'app/percona/shared/components/PerconaBootstrapper/PerconaUpdateVersion/PerconaUpdateVersion.constants';
import * as GrafanaUpdates from 'app/percona/shared/core/reducers/updates/updates';
import * as User from 'app/percona/shared/core/reducers/user/user';
import { UpdatesService } from 'app/percona/shared/services/updates';
import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import PerconaUpdateVersion from './PerconaUpdateVersion';

const checkUpdatesChangeLogsSpy = jest.spyOn(GrafanaUpdates, 'checkUpdatesChangeLogs');
const setSnoozedVersionSpy = jest.spyOn(User, 'setSnoozedVersion');

jest.mock('app/percona/shared/services/user/User.service');

describe('PerconaUpdateVersion', () => {
  const setup = (state: Partial<StoreState['percona']>, updatesEnabled = true) =>
    render(
      <Provider
        store={configureStore({
          percona: {
            settings: {
              result: {
                updatesEnabled,
              },
            },
            ...state,
          },
        } as StoreState)}
      >
        <PerconaUpdateVersion />
      </Provider>
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal with one update', async () => {
    const changeLogsAPIResponse = {
      last_check: '',
      updates: [
        {
          version: 'PMM 3.0.1',
          tag: 'string',
          timestamp: '2024-09-23T09:12:31.488Z',
          release_notes_url: 'http://localhost:3000',
          release_notes_text: 'text1',
        },
      ],
    };
    const state = {
      updates: {
        isLoading: false,
        updateAvailable: true,
        latest: { version: '3.0.1' },
        lastChecked: '',
        showUpdateModal: true,
      },
    };
    jest.spyOn(UpdatesService, 'getUpdatesChangelogs').mockReturnValue(Promise.resolve({ ...changeLogsAPIResponse }));

    setup(state);
    await waitFor(() => {
      expect(checkUpdatesChangeLogsSpy).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('one-update-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('multiple-updates-modal')).not.toBeInTheDocument();
  });

  it('should render modal with multiple updates', async () => {
    const changeLogsAPIResponse = {
      last_check: '',
      updates: [
        {
          version: 'PMM 3.0.1',
          tag: 'string',
          timestamp: '2024-09-27T09:12:31.488Z',
          release_notes_url: 'http://localhost:3000',
          release_notes_text: 'text1',
        },
        {
          version: 'PMM 3.0.2',
          tag: 'string',
          timestamp: '2024-09-23T09:12:31.488Z',
          release_notes_url: 'http://localhost:3000',
          release_notes_text: 'text2',
        },
      ],
    };
    const state = {
      updates: {
        isLoading: false,
        updateAvailable: true,
        latest: { version: '3.0.1' },
        lastChecked: '',
        showUpdateModal: true,
      },
    };
    jest.spyOn(UpdatesService, 'getUpdatesChangelogs').mockReturnValue(Promise.resolve({ ...changeLogsAPIResponse }));

    setup(state);
    await waitFor(() => {
      expect(checkUpdatesChangeLogsSpy).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('one-update-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('multiple-updates-modal')).toBeInTheDocument();
  });

  it('should dispatch setSnoozedVersion when pressing button', async () => {
    const changeLogsAPIResponse = {
      last_check: '',
      updates: [
        {
          version: 'PMM 3.0.1',
          tag: 'string',
          timestamp: '2024-09-23T09:12:31.488Z',
          release_notes_url: 'http://localhost:3000',
          release_notes_text: 'text1',
        },
      ],
    };
    const state = {
      updates: {
        isLoading: false,
        updateAvailable: true,
        latest: { version: '3.0.1' },
        lastChecked: '',
        showUpdateModal: true,
      },
    };
    jest.spyOn(UpdatesService, 'getUpdatesChangelogs').mockReturnValue(Promise.resolve({ ...changeLogsAPIResponse }));

    setup(state);
    await waitFor(() => {
      expect(checkUpdatesChangeLogsSpy).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: Messages.snooze }));

    await waitFor(() => {
      expect(setSnoozedVersionSpy).toHaveBeenCalled();
    });
  });

  it("shouldn't render modal when updates are disabled", async () => {
    const state = {
      updates: {
        isLoading: false,
        updateAvailable: true,
        latest: { version: '3.0.1' },
        lastChecked: '',
        showUpdateModal: true,
      },
    };

    setup(state, false);
    await waitFor(() => {
      expect(checkUpdatesChangeLogsSpy).not.toHaveBeenCalled();
    });

    expect(screen.queryByTestId('one-update-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('multiple-updates-modal')).not.toBeInTheDocument();
  });
});
