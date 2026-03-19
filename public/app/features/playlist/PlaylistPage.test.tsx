import { render, screen } from '@testing-library/react';
import { of } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';

import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

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
    hasPermission: jest.fn(),
    isEditor: false,
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
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
    (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = false;
    config.featureToggles.playlistsRBAC = false;
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

    describe('with playlistsRBAC toggle on', () => {
      beforeEach(() => {
        config.featureToggles.playlistsRBAC = true;
      });

      describe('and user has playlists:write', () => {
        it('then create playlist button should not be disabled', async () => {
          jest
            .mocked(contextSrv.hasPermission)
            .mockImplementation((action) => action === AccessControlAction.PlaylistsWrite);
          setup();
          const createPlaylistButton = await screen.findByRole('link', { name: /create playlist/i });
          expect(createPlaylistButton).not.toHaveStyle('pointer-events: none');
        });
      });

      describe('and user does not have playlists:write (isEditor is ignored)', () => {
        it('then create playlist button should be disabled', async () => {
          jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
          (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true;
          setup();
          const createPlaylistButton = await screen.findByRole('link', { name: /create playlist/i });
          expect(createPlaylistButton).toHaveStyle('pointer-events: none');
        });
      });
    });

    describe('with playlistsRBAC toggle off (legacy)', () => {
      describe('and user is an editor', () => {
        it('then create playlist button should not be disabled', async () => {
          (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true;
          setup();
          const createPlaylistButton = await screen.findByRole('link', { name: /create playlist/i });
          expect(createPlaylistButton).not.toHaveStyle('pointer-events: none');
        });
      });

      describe('and user is not an editor', () => {
        it('then create playlist button should be disabled', async () => {
          setup();
          const createPlaylistButton = await screen.findByRole('link', { name: /create playlist/i });
          expect(createPlaylistButton).toHaveStyle('pointer-events: none');
        });
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

    describe('with playlistsRBAC toggle on', () => {
      beforeEach(() => {
        config.featureToggles.playlistsRBAC = true;
      });

      describe('and user has playlists:write', () => {
        it('then all playlist buttons should appear', async () => {
          jest
            .mocked(contextSrv.hasPermission)
            .mockImplementation((action) => action === AccessControlAction.PlaylistsWrite);
          setup();
          expect(await screen.findByText('A test playlist'));
          expect(await screen.findByRole('link', { name: /New playlist/i })).toBeInTheDocument();
          expect(await screen.findByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
          expect(await screen.findByRole('link', { name: /Edit playlist/i })).toBeInTheDocument();
          expect(await screen.findByRole('button', { name: /Delete playlist/i })).toBeInTheDocument();
        });
      });

      describe('and user does not have playlists:write (isEditor is ignored)', () => {
        it('then only start playlist button should appear', async () => {
          jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
          (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true;
          setup();
          expect(await screen.findByText('A test playlist')).toBeInTheDocument();
          expect(screen.queryByRole('link', { name: /New playlist/i })).not.toBeInTheDocument();
          expect(await screen.findByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
          expect(screen.queryByRole('link', { name: /Edit playlist/i })).not.toBeInTheDocument();
          expect(screen.queryByRole('button', { name: /Delete playlist/i })).not.toBeInTheDocument();
        });
      });
    });

    describe('with playlistsRBAC toggle off (legacy)', () => {
      describe('and user is an editor', () => {
        it('then all playlist buttons should appear', async () => {
          jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
          (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true;
          setup();
          expect(await screen.findByText('A test playlist'));
          expect(await screen.findByRole('link', { name: /New playlist/i })).toBeInTheDocument();
          expect(await screen.findByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
          expect(await screen.findByRole('link', { name: /Edit playlist/i })).toBeInTheDocument();
          expect(await screen.findByRole('button', { name: /Delete playlist/i })).toBeInTheDocument();
        });
      });

      describe('and user is not an editor', () => {
        it('then only start playlist button should appear', async () => {
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
});
