import { render, waitFor } from '@testing-library/react';
import React from 'react';

import { contextSrv } from 'app/core/services/context_srv';

import { PlaylistPage } from './PlaylistPage';

const fnMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => ({
    get: fnMock,
  }),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    isEditor: true,
  },
}));

function getTestContext() {
  return render(<PlaylistPage />);
}

describe('PlaylistPage', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

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
    describe('and signed in user is not a viewer', () => {
      it('then create playlist button should not be disabled', async () => {
        contextSrv.isEditor = true;
        const { getByRole } = getTestContext();
        const createPlaylistButton = await waitFor(() => getByRole('link', { name: /create playlist/i }));
        expect(createPlaylistButton).not.toHaveStyle('pointer-events: none');
      });
    });
    describe('and signed in user is a viewer', () => {
      it('then create playlist button should be disabled', async () => {
        contextSrv.isEditor = false;
        const { getByRole } = getTestContext();
        const createPlaylistButton = await waitFor(() => getByRole('link', { name: /create playlist/i }));
        expect(createPlaylistButton).toHaveStyle('pointer-events: none');
      });
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
            { title: 'First item', type: 'dashboard_by_uid', value: '1' },
            { title: 'Middle item', type: 'dashboard_by_uid', value: '2' },
            { title: 'Last item', type: 'dashboard_by_tag', value: 'Last item' },
          ],
          uid: 'playlist-0',
        },
      ]);
      const { getByText } = getTestContext();
      expect(getByText(/loading/i)).toBeInTheDocument();
    });
    describe('and signed in user is not a viewer', () => {
      it('then playlist title and all playlist buttons should appear on the page', async () => {
        contextSrv.isEditor = true;
        const { getByRole, getByText } = getTestContext();
        await waitFor(() => getByText('A test playlist'));
        expect(getByRole('link', { name: /New playlist/i })).toBeInTheDocument();
        expect(getByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
        expect(getByRole('link', { name: /Edit playlist/i })).toBeInTheDocument();
        expect(getByRole('button', { name: /Delete playlist/i })).toBeInTheDocument();
      });
    });
    describe('and signed in user is a viewer', () => {
      it('then playlist title and only start playlist button should appear on the page', async () => {
        contextSrv.isEditor = false;
        const { getByRole, getByText, queryByRole } = getTestContext();
        await waitFor(() => getByText('A test playlist'));
        expect(queryByRole('link', { name: /New playlist/i })).not.toBeInTheDocument();
        expect(getByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
        expect(queryByRole('link', { name: /Edit playlist/i })).not.toBeInTheDocument();
        expect(queryByRole('button', { name: /Delete playlist/i })).not.toBeInTheDocument();
      });
    });
  });
});
