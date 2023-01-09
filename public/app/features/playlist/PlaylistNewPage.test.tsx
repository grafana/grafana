import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';

import { backendSrv } from '../../core/services/backend_srv';
import { configureStore } from '../../store/configureStore';

import { PlaylistNewPage } from './PlaylistNewPage';
import { Playlist } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

jest.mock('app/core/components/TagFilter/TagFilter', () => ({
  TagFilter: () => {
    return <>mocked-tag-filter</>;
  },
}));

function getTestContext({ name, interval, items }: Partial<Playlist> = {}) {
  const store = configureStore();
  jest.clearAllMocks();
  const playlist = { name, items, interval } as unknown as Playlist;
  const backendSrvMock = jest.spyOn(backendSrv, 'post');

  const { rerender } = render(
    <Provider store={store}>
      <PlaylistNewPage />
    </Provider>
  );

  return { playlist, rerender, backendSrvMock };
}

describe('PlaylistNewPage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('when mounted', () => {
    it('then header should be correct', () => {
      getTestContext();

      expect(screen.getByRole('heading', { name: /new playlist/i })).toBeInTheDocument();
    });
  });

  describe('when submitted', () => {
    it('then correct api should be called', async () => {
      const { backendSrvMock } = getTestContext();

      expect(locationService.getLocation().pathname).toEqual('/');

      await userEvent.type(screen.getByRole('textbox', { name: selectors.pages.PlaylistForm.name }), 'A new name');
      fireEvent.submit(screen.getByRole('button', { name: /save/i }));
      await waitFor(() => expect(backendSrvMock).toHaveBeenCalledTimes(1));
      expect(backendSrvMock).toHaveBeenCalledWith('/api/playlists', {
        name: 'A new name',
        interval: '5m',
        items: [],
      });
      expect(locationService.getLocation().pathname).toEqual('/playlists');
    });
  });
});
