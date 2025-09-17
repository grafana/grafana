import { render, screen } from '@testing-library/react';
import { of } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';

import { contextSrv } from 'app/core/services/context_srv';

import { createFetchResponse } from '../../../test/helpers/createFetchResponse';
import { backendSrv } from '../../core/services/backend_srv';

import { PlaylistPage } from './PlaylistPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    isEditor: true,
  },
}));

function setup() {
  return render(
    <TestProvider>
      <PlaylistPage />
    </TestProvider>
  );
}

describe('PlaylistPage', () => {
  beforeEach(() => {
    jest.spyOn(backendSrv, 'fetch').mockImplementation(() => of(createFetchResponse({})));
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('when mounted without a playlist', () => {
    it('page should load', () => {
      setup();
      expect(screen.getByTestId('playlist-page-list-skeleton')).toBeInTheDocument();
    });

    it('then show empty list', async () => {
      setup();
      expect(await screen.findByText('There are no playlists created yet')).toBeInTheDocument();
    });

    describe('and signed in user is not a viewer', () => {
      it('then create playlist button should not be disabled', async () => {
        contextSrv.isEditor = true;
        setup();
        const createPlaylistButton = await screen.findByRole('link', { name: /create playlist/i });
        expect(createPlaylistButton).not.toHaveStyle('pointer-events: none');
      });
    });

    describe('and signed in user is a viewer', () => {
      it('then create playlist button should be disabled', async () => {
        contextSrv.isEditor = false;
        setup();
        const createPlaylistButton = await screen.findByRole('link', { name: /create playlist/i });
        expect(createPlaylistButton).toHaveStyle('pointer-events: none');
      });
    });
  });

  describe('when mounted with a playlist', () => {
    beforeEach(() => {
      jest.spyOn(backendSrv, 'fetch').mockImplementation(() =>
        of(
          createFetchResponse({
            items: [
              {
                spec: {
                  title: 'A test playlist',
                  interval: '10m',
                  items: [
                    { title: 'First item', type: 'dashboard_by_uid', value: '1' },
                    { title: 'Middle item', type: 'dashboard_by_uid', value: '2' },
                    { title: 'Last item', type: 'dashboard_by_tag', value: 'Last item' },
                  ],
                },
                metadata: {
                  name: 0,
                  uid: 'playlist-0',
                },
              },
            ],
          })
        )
      );
    });

    it('page should load', () => {
      setup();
      expect(screen.getByTestId('playlist-page-list-skeleton')).toBeInTheDocument();
    });

    describe('and signed in user is not a viewer', () => {
      it('then playlist title and all playlist buttons should appear on the page', async () => {
        contextSrv.isEditor = true;
        setup();
        expect(await screen.findByText('A test playlist'));
        expect(await screen.findByRole('link', { name: /New playlist/i })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
        expect(await screen.findByRole('link', { name: /Edit playlist/i })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: /Delete playlist/i })).toBeInTheDocument();
      });
    });

    describe('and signed in user is a viewer', () => {
      it('then playlist title and only start playlist button should appear on the page', async () => {
        contextSrv.isEditor = false;
        setup();
        expect(await screen.findByText('A test playlist')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /New playlist/i })).not.toBeInTheDocument();
        expect(await screen.findByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Edit playlist/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Delete playlist/i })).not.toBeInTheDocument();
      });
    });
  });
});
