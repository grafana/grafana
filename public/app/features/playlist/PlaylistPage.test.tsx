import { render, screen } from '@testing-library/react';
import { of } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';

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

    describe('and user has playlists:write (RBAC active)', () => {
      it('then create playlist button should not be disabled', async () => {
        jest
          .mocked(contextSrv.hasPermission)
          .mockImplementation(
            (action) => action === AccessControlAction.PlaylistsRead || action === AccessControlAction.PlaylistsWrite
          );
        setup();
        const createPlaylistButton = await screen.findByRole('link', { name: /create playlist/i });
        expect(createPlaylistButton).not.toHaveStyle('pointer-events: none');
      });
    });

    describe('and user does not have playlists:write but is an editor (legacy fallback)', () => {
      it('then create playlist button should not be disabled', async () => {
        jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
        (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true;
        setup();
        const createPlaylistButton = await screen.findByRole('link', { name: /create playlist/i });
        expect(createPlaylistButton).not.toHaveStyle('pointer-events: none');
      });
    });

    describe('and user does not have playlists:write and is not an editor', () => {
      it('then create playlist button should be disabled', async () => {
        jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
        (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = false;
        setup();
        const createPlaylistButton = await screen.findByRole('link', { name: /create playlist/i });
        expect(createPlaylistButton).toHaveStyle('pointer-events: none');
      });
    });

    describe('and user has playlists:read but not playlists:write (RBAC active, read-only)', () => {
      it('then create playlist button should be disabled', async () => {
        jest
          .mocked(contextSrv.hasPermission)
          .mockImplementation((action) => action === AccessControlAction.PlaylistsRead);
        (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true; // isEditor should be ignored when RBAC is active
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

    describe('and user has playlists:write (RBAC active)', () => {
      it('then playlist title and all playlist buttons should appear on the page', async () => {
        jest
          .mocked(contextSrv.hasPermission)
          .mockImplementation(
            (action) => action === AccessControlAction.PlaylistsRead || action === AccessControlAction.PlaylistsWrite
          );
        setup();
        expect(await screen.findByText('A test playlist'));
        expect(await screen.findByRole('link', { name: /New playlist/i })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
        expect(await screen.findByRole('link', { name: /Edit playlist/i })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: /Delete playlist/i })).toBeInTheDocument();
      });
    });

    describe('and user is an editor (legacy fallback — no playlists:read means RBAC not active)', () => {
      it('then playlist title and all playlist buttons should appear on the page', async () => {
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

    describe('and user does not have playlists:write and is not an editor', () => {
      it('then playlist title and only start playlist button should appear on the page', async () => {
        jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
        (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = false;
        setup();
        expect(await screen.findByText('A test playlist')).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /New playlist/i })).not.toBeInTheDocument();
        expect(await screen.findByRole('button', { name: /Start playlist/i })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: /Edit playlist/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Delete playlist/i })).not.toBeInTheDocument();
      });
    });

    describe('and user has playlists:read but not playlists:write (RBAC active, read-only)', () => {
      it('then only start playlist button should appear — isEditor is ignored when RBAC is active', async () => {
        jest
          .mocked(contextSrv.hasPermission)
          .mockImplementation((action) => action === AccessControlAction.PlaylistsRead);
        (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true; // should be ignored
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
