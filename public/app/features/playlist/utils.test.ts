import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { canWritePlaylists } from './utils';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    hasPermission: jest.fn(),
    isEditor: false,
  },
}));

describe('canWritePlaylists', () => {
  beforeEach(() => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
    (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = false;
    setTestFlags({ [FlagKeys.GrafanaPlaylistsRBAC]: false });
  });

  afterEach(() => {
    setTestFlags({});
  });

  describe('with grafana.playlistsRBAC toggle off (legacy)', () => {
    it('returns true when user is an editor', () => {
      (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true;
      expect(canWritePlaylists()).toBe(true);
    });

    it('returns false when user is not an editor', () => {
      expect(canWritePlaylists()).toBe(false);
    });
  });

  describe('with grafana.playlistsRBAC toggle on', () => {
    beforeEach(() => {
      setTestFlags({ [FlagKeys.GrafanaPlaylistsRBAC]: true });
    });

    it('returns true when user has playlists:write', () => {
      jest
        .mocked(contextSrv.hasPermission)
        .mockImplementation((action) => action === AccessControlAction.PlaylistsWrite);
      expect(canWritePlaylists()).toBe(true);
    });

    it('returns false when user lacks playlists:write, even if isEditor', () => {
      (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true;
      expect(canWritePlaylists()).toBe(false);
    });
  });
});
