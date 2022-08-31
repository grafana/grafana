import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { locationService } from '@grafana/runtime';

import { backendSrv } from '../../core/services/backend_srv';

import { PlaylistNewPage } from './PlaylistNewPage';
import { Playlist } from './types';

jest.mock('./usePlaylist', () => ({
  // so we don't need to add dashboard items in test
  usePlaylist: jest.fn().mockReturnValue({
    playlist: { items: [{ title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' }], loading: false },
  }),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

jest.mock('../../core/components/TagFilter/TagFilter', () => ({
  TagFilter: () => {
    return <>mocked-tag-filter</>;
  },
}));

function getTestContext({ name, interval, items }: Partial<Playlist> = {}) {
  jest.clearAllMocks();
  const playlist = { name, items, interval } as unknown as Playlist;
  const backendSrvMock = jest.spyOn(backendSrv, 'post');

  const { rerender } = render(<PlaylistNewPage />);

  return { playlist, rerender, backendSrvMock };
}

describe('PlaylistNewPage', () => {
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
      await userEvent.type(screen.getByRole('textbox', { name: /playlist name/i }), 'A Name');
      fireEvent.submit(screen.getByRole('button', { name: /save/i }));
      await waitFor(() => expect(backendSrvMock).toHaveBeenCalledTimes(1));
      expect(backendSrvMock).toHaveBeenCalledWith('/api/playlists', {
        name: 'A Name',
        interval: '5m',
        items: [{ title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' }],
      });
      expect(locationService.getLocation().pathname).toEqual('/playlists');
    });
  });
});
