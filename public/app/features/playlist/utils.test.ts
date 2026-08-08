import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { PLAYLIST_CUSTOM_VIEW_TITLE_PARAM, PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM } from './customView';
import { canWritePlaylists, getPlaylistShortLinkUid, normalizeDashboardViewQueryString } from './utils';

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
    config.featureToggles.playlistsRBAC = false;
  });

  describe('with playlistsRBAC toggle off (legacy)', () => {
    it('returns true when user is an editor', () => {
      (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true;
      expect(canWritePlaylists()).toBe(true);
    });

    it('returns false when user is not an editor', () => {
      expect(canWritePlaylists()).toBe(false);
    });
  });

  describe('with playlistsRBAC toggle on', () => {
    beforeEach(() => {
      config.featureToggles.playlistsRBAC = true;
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

describe('normalizeDashboardViewQueryString', () => {
  it.each([
    ['var-host=host1&from=now-6h', 'var-host=host1&from=now-6h'],
    ['?var-host=host1&from=now-6h', 'var-host=host1&from=now-6h'],
    ['https://grafana.example.com/d/uid/name?var-host=host1&from=now-6h#view', 'var-host=host1&from=now-6h'],
    [`/d/uid/name?var-host=host1&${PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM}=temporary`, 'var-host=host1'],
    [`/d/uid/name?var-host=host1&${PLAYLIST_CUSTOM_VIEW_TITLE_PARAM}=Playlist+name`, 'var-host=host1'],
    [
      '/d/uid/name?var-host=host1&orgId=2&auth_token=secret&forceLogin=true&kiosk&autofitpanels&hideLogo&_dash.hideTimePicker=true',
      'var-host=host1',
    ],
    ['var-host=host1&var-host=host2', 'var-host=host1&var-host=host2'],
    ['https://grafana.example.com/d/uid/name', undefined],
    ['/d/uid/name#view', undefined],
    ['', undefined],
    ['  ', undefined],
  ])('normalizes %s', (value, expected) => {
    expect(normalizeDashboardViewQueryString(value)).toBe(expected);
  });
});

describe('getPlaylistShortLinkUid', () => {
  it.each([
    ['https://grafana.example.com/goto/short123?orgId=1', 'short123'],
    ['/goto/short123', 'short123'],
    ['https://grafana.example.com/grafana/goto/short%20123', 'short 123'],
    ['https://grafana.example.com/d/uid/name?var-host=host1', undefined],
    ['var-host=host1', undefined],
  ])('extracts a short-link UID from %s', (value, expected) => {
    expect(getPlaylistShortLinkUid(value)).toBe(expected);
  });
});
