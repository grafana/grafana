import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Playlist } from './types';
import { PlaylistNewPage } from './PlaylistNewPage';
import { backendSrv } from '../../core/services/backend_srv';
import { locationService } from '@grafana/runtime';

jest.mock('./usePlaylist', () => ({
  // so we don't need to add dashboard items in test
  usePlaylist: jest.fn().mockReturnValue({
    playlist: { items: [{ title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' }], loading: false },
  }),
}));

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as any),
  getBackendSrv: () => backendSrv,
}));

function getTestContext({ name, interval, items }: Partial<Playlist> = {}) {
  jest.clearAllMocks();
  const playlist = ({ name, items, interval } as unknown) as Playlist;
  const queryParams = {};
  const route: any = {};
  const match: any = {};
  const location: any = {};
  const history: any = {};
  const navModel: any = {
    node: {},
    main: {},
  };
  const backendSrvMock = jest.spyOn(backendSrv, 'post');
  const { rerender } = render(
    <PlaylistNewPage
      queryParams={queryParams}
      route={route}
      match={match}
      location={location}
      history={history}
      navModel={navModel}
    />
  );

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
      userEvent.type(screen.getByRole('textbox', { name: /playlist name/i }), 'A Name');
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
