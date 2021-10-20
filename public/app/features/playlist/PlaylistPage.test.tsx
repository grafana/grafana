import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { PlaylistPage, PlaylistPageProps } from './PlaylistPage';
import { locationService } from '../../../../packages/grafana-runtime/src';

const fnMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => ({
    get: fnMock,
  }),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    isEditor: true,
  },
}));

function getTestContext(propOverrides?: object) {
  const props: PlaylistPageProps = {
    navModel: {
      main: {
        text: 'Playlist',
      },
      node: {
        text: 'playlist',
      },
    },
    route: {
      path: '/playlists',
      component: jest.fn(),
    },
    queryParams: { state: 'ok' },
    match: { params: { name: 'playlist', sourceName: 'test playlist' }, isExact: false, url: 'asdf', path: '' },
    history: locationService.getHistory(),
    location: { pathname: '', hash: '', search: '', state: '' },
  };

  Object.assign(props, propOverrides);

  return render(<PlaylistPage {...props} />);
}

describe('PlaylistPage', () => {
  describe('when mounted without a playlist', () => {
    it('page should load', () => {
      fnMock.mockResolvedValue([]);
      const { getByText } = getTestContext();
      expect(getByText(/loading/i)).toBeInTheDocument();
    });
    it('then show empty list', async () => {
      const { getByText } = getTestContext();
      await waitFor(() => getByText('There are no playlists created yet'));
    });
  });
  describe('when mounted with a playlist', () => {
    it('page should load', () => {
      fnMock.mockResolvedValue([
        {
          id: 0,
          name: 'A test playlist',
          interval: '10m',
          items: [
            { title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' },
            { title: 'Middle item', type: 'dashboard_by_id', order: 2, value: '2' },
            { title: 'Last item', type: 'dashboard_by_tag', order: 2, value: 'Last item' },
          ],
        },
      ]);
      const { getByText } = getTestContext();
      expect(getByText(/loading/i)).toBeInTheDocument();
    });
    it('then playlist title and buttons should appear on the page', async () => {
      const { getByRole, getByText } = getTestContext();
      await waitFor(() => getByText('A test playlist'));
      expect(getByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
      expect(getByRole('link', { name: /Edit playlist/i })).toBeInTheDocument();
      expect(getByRole('button', { name: /Delete playlist/i })).toBeInTheDocument();
    });
  });
});
