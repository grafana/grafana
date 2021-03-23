import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Playlist } from './types';
import { PlaylistEditPage } from './PlaylistEditPage';
import { backendSrv } from 'app/core/services/backend_srv';
import userEvent from '@testing-library/user-event';
import { locationService } from '@grafana/runtime';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as any),
  getBackendSrv: () => backendSrv,
}));

async function getTestContext({ name, interval, items }: Partial<Playlist> = {}) {
  jest.clearAllMocks();
  const playlist = ({ name, items, interval } as unknown) as Playlist;
  const queryParams = {};
  const route: any = {};
  const match: any = { params: { id: 1 } };
  const location: any = {};
  const history: any = {};
  const navModel: any = {
    node: {},
    main: {},
  };
  const getMock = jest.spyOn(backendSrv, 'get');
  const putMock = jest.spyOn(backendSrv, 'put');
  getMock.mockResolvedValue({
    name: 'Test Playlist',
    interval: '5s',
    items: [{ title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' }],
  });
  const { rerender } = render(
    <PlaylistEditPage
      queryParams={queryParams}
      route={route}
      match={match}
      location={location}
      history={history}
      navModel={navModel}
    />
  );
  await waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));

  return { playlist, rerender, putMock };
}

describe('PlaylistEditPage', () => {
  describe('when mounted', () => {
    it('then it should load playlist and header should be correct', async () => {
      await getTestContext();

      expect(screen.getByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /playlist name/i })).toHaveValue('Test Playlist');
      expect(screen.getByRole('textbox', { name: /playlist interval/i })).toHaveValue('5s');
      expect(screen.getAllByRole('row', { name: /playlist item row/i })).toHaveLength(1);
    });
  });

  describe('when submitted', () => {
    it('then correct api should be called', async () => {
      const { putMock } = await getTestContext();

      expect(locationService.getLocation().pathname).toEqual('/');
      userEvent.clear(screen.getByRole('textbox', { name: /playlist name/i }));
      userEvent.type(screen.getByRole('textbox', { name: /playlist name/i }), 'A Name');
      userEvent.clear(screen.getByRole('textbox', { name: /playlist interval/i }));
      userEvent.type(screen.getByRole('textbox', { name: /playlist interval/i }), '10s');
      fireEvent.submit(screen.getByRole('button', { name: /save/i }));
      await waitFor(() => expect(putMock).toHaveBeenCalledTimes(1));
      expect(putMock).toHaveBeenCalledWith('/api/playlists/1', {
        name: 'A Name',
        interval: '10s',
        items: [{ title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' }],
      });
      expect(locationService.getLocation().pathname).toEqual('/playlists');
    });
  });
});
