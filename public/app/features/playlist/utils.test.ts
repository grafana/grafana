import { act, getWrapper, renderHook } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM } from './customView';
import { getPlaylistShortLinkUid, normalizeDashboardViewQueryString, useCanWritePlaylists } from './utils';

jest.mock('app/core/services/context_srv', () => ({
  ...jest.requireActual('app/core/services/context_srv'),
  contextSrv: {
    ...jest.requireActual('app/core/services/context_srv').contextSrv,
    hasPermission: jest.fn(),
    isEditor: false,
  },
}));

const renderUseCanWritePlaylists = () => renderHook(() => useCanWritePlaylists(), { wrapper: getWrapper({}) });

describe('useCanWritePlaylists', () => {
  beforeEach(() => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(false);
    (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = false;
    setTestFlags({ playlistsRBAC: false });
  });

  afterEach(async () => {
    // Wrap in act() — setTestFlags fires OpenFeature events that trigger state updates
    // while the previous test's hook is still mounted (RTL cleanup runs afterward).
    await act(async () => {
      setTestFlags({});
    });
  });

  describe('with playlistsRBAC toggle off (legacy)', () => {
    it('returns true when user is an editor', () => {
      (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true;
      const { result } = renderUseCanWritePlaylists();
      expect(result.current).toBe(true);
    });

    it('returns false when user is not an editor', () => {
      const { result } = renderUseCanWritePlaylists();
      expect(result.current).toBe(false);
    });
  });

  describe('with playlistsRBAC toggle on', () => {
    beforeEach(() => {
      setTestFlags({ playlistsRBAC: true });
    });

    it('returns true when user has playlists:write', () => {
      jest
        .mocked(contextSrv.hasPermission)
        .mockImplementation((action) => action === AccessControlAction.PlaylistsWrite);
      const { result } = renderUseCanWritePlaylists();
      expect(result.current).toBe(true);
    });

    it('returns false when user lacks playlists:write, even if isEditor', () => {
      (contextSrv as jest.Mocked<typeof contextSrv>).isEditor = true;
      const { result } = renderUseCanWritePlaylists();
      expect(result.current).toBe(false);
    });
  });
});

describe('normalizeDashboardViewQueryString', () => {
  it.each([
    ['var-host=host1&from=now-6h', 'var-host=host1&from=now-6h'],
    ['?var-host=host1&from=now-6h', 'var-host=host1&from=now-6h'],
    ['https://grafana.example.com/d/uid/name?var-host=host1&from=now-6h#view', 'var-host=host1&from=now-6h'],
    [`/d/uid/name?var-host=host1&${PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM}=temporary`, 'var-host=host1'],
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
