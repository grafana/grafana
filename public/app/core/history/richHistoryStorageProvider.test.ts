import 'fake-indexeddb/auto';

import { config, reportInteraction } from '@grafana/runtime';
import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { dispatch } from 'app/store/store';

import RichHistoryIndexedDBStorage from './RichHistoryIndexedDBStorage';
import RichHistoryLocalStorage from './RichHistoryLocalStorage';
import RichHistoryRemoteStorage from './RichHistoryRemoteStorage';
import { getRichHistoryStorage, getLocalRichHistoryStorage } from './richHistoryStorageProvider';

// The real RichHistoryRemoteStorage pulls in the explore/dashboard feature graph, which re-enters
// this provider mid-evaluation (a genuine module cycle) and leaves the class undefined when the
// provider runs `new RichHistoryRemoteStorage()`. Stubbing it breaks the cycle; because the factory
// runs once, the test and the provider share the same stub class, so `instanceof` still verifies
// that the provider selected the remote-storage branch.
jest.mock('./RichHistoryRemoteStorage', () => ({
  __esModule: true,
  default: class RichHistoryRemoteStorage {},
}));

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    reportInteraction: jest.fn(),
    config: { ...actual.config, queryHistoryEnabled: false },
  };
});

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getFeatureFlagClient: jest.fn(),
}));

jest.mock('app/store/store', () => ({ dispatch: jest.fn() }));

function setFlag(value: boolean) {
  (getFeatureFlagClient as jest.Mock).mockReturnValue({ getBooleanValue: () => value });
}

// The provider owns a module-level `indexedDBWarningShown` latch that cannot be reset without a
// module reload (and reloading breaks `instanceof` due to class identity across registries). The
// one-shot warning test therefore runs FIRST, while the latch is still false; later tests assert
// only `instanceof` and never the warning count, so the tripped latch is harmless.
describe('richHistoryStorageProvider', () => {
  // `fake-indexeddb/auto` (imported above) installs a working IndexedDB on the global, since jsdom
  // provides none. We restore it before each test and `delete` it in the fallback tests.
  const fakeIndexedDB = globalThis.indexedDB;

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.indexedDB = fakeIndexedDB;
    config.queryHistoryEnabled = false;
  });

  afterAll(() => {
    globalThis.indexedDB = fakeIndexedDB;
  });

  it('falls back to localStorage with a one-shot warning when IndexedDB is unavailable', () => {
    setFlag(true);
    // @ts-expect-error simulate a browser/environment without IndexedDB
    delete globalThis.indexedDB;

    const storage = getRichHistoryStorage();
    expect(storage).toBeInstanceOf(RichHistoryLocalStorage);
    expect(reportInteraction).toHaveBeenCalledTimes(1);
    expect(reportInteraction).toHaveBeenCalledWith('grafana_query_history_indexeddb_unavailable', {
      fallback: 'localStorage',
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
    // Match the title only — notifyApp injects an id/timestamp into the payload.
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ title: 'Query history: IndexedDB is unavailable' }),
      })
    );

    // The warning latch is module-level: subsequent calls must not re-report or re-notify.
    getRichHistoryStorage();
    getRichHistoryStorage();
    expect(reportInteraction).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  describe('getRichHistoryStorage', () => {
    it('returns IndexedDB storage when the flag is on and IndexedDB is available', () => {
      setFlag(true);
      expect(getRichHistoryStorage()).toBeInstanceOf(RichHistoryIndexedDBStorage);
    });

    it('returns remote storage when the flag is off and query history is enabled', () => {
      setFlag(false);
      config.queryHistoryEnabled = true;
      expect(getRichHistoryStorage()).toBeInstanceOf(RichHistoryRemoteStorage);
    });

    it('returns localStorage when the flag is off and query history is disabled', () => {
      setFlag(false);
      config.queryHistoryEnabled = false;
      expect(getRichHistoryStorage()).toBeInstanceOf(RichHistoryLocalStorage);
    });
  });

  describe('getLocalRichHistoryStorage', () => {
    it('returns IndexedDB storage when the flag is on', () => {
      setFlag(true);
      expect(getLocalRichHistoryStorage()).toBeInstanceOf(RichHistoryIndexedDBStorage);
    });

    it('returns localStorage when the flag is off (ignores queryHistoryEnabled)', () => {
      setFlag(false);
      config.queryHistoryEnabled = true;
      expect(getLocalRichHistoryStorage()).toBeInstanceOf(RichHistoryLocalStorage);
    });

    // Runs after the one-shot warning test, which already tripped the module-level latch.
    it('falls back to localStorage when IndexedDB is unavailable even with the flag on', () => {
      setFlag(true);
      // @ts-expect-error simulate a browser/environment without IndexedDB
      delete globalThis.indexedDB;
      expect(getLocalRichHistoryStorage()).toBeInstanceOf(RichHistoryLocalStorage);
    });
  });
});
