import { act, getWrapper, renderHook } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { useCanWritePlaylists } from './utils';

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
