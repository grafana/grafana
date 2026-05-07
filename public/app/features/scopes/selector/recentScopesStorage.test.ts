import { type Scope, type Store } from '@grafana/data';

import {
  RECENT_SCOPES_CHANGED_EVENT,
  RECENT_SCOPES_MAX,
  readStoredRecentScopes,
  writeRecentScope,
  type StoredRecentScopeSet,
} from './recentScopesStorage';

jest.mock('@grafana/runtime', () => ({
  config: { buildInfo: { version: '10.0.0' } },
}));

const mockStore = {
  get: jest.fn<string | undefined, [string]>(),
  set: jest.fn(),
} as unknown as Store;

function makeScope(name: string, defaultPath?: string[]): Scope {
  return {
    metadata: { name },
    spec: { title: name, filters: [], ...(defaultPath ? { defaultPath } : {}) },
  };
}

describe('readStoredRecentScopes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty array for empty string in store', () => {
    (mockStore.get as jest.Mock).mockReturnValue('');
    expect(readStoredRecentScopes(mockStore)).toEqual([]);
  });

  it('returns empty array for null in store', () => {
    (mockStore.get as jest.Mock).mockReturnValue(null);
    expect(readStoredRecentScopes(mockStore)).toEqual([]);
  });

  it('returns empty array for undefined in store', () => {
    (mockStore.get as jest.Mock).mockReturnValue(undefined);
    expect(readStoredRecentScopes(mockStore)).toEqual([]);
  });

  it('returns empty array for malformed JSON', () => {
    (mockStore.get as jest.Mock).mockReturnValue('not-json{{{');
    expect(readStoredRecentScopes(mockStore)).toEqual([]);
  });

  it('returns empty array when JSON is not an array', () => {
    (mockStore.get as jest.Mock).mockReturnValue(JSON.stringify({ scopeIds: ['a'] }));
    expect(readStoredRecentScopes(mockStore)).toEqual([]);
  });

  it('skips entries with empty scopeIds', () => {
    const data = [{ scopeIds: [], version: '10.0.0' }];
    (mockStore.get as jest.Mock).mockReturnValue(JSON.stringify(data));
    expect(readStoredRecentScopes(mockStore)).toEqual([]);
  });

  it('skips null entries', () => {
    const data = [null, { scopeIds: ['scope-a'], version: '10.0.0' }];
    (mockStore.get as jest.Mock).mockReturnValue(JSON.stringify(data));
    expect(readStoredRecentScopes(mockStore)).toHaveLength(1);
  });

  it('skips non-object entries', () => {
    const data = ['string', 42, { scopeIds: ['scope-a'], version: '10.0.0' }];
    (mockStore.get as jest.Mock).mockReturnValue(JSON.stringify(data));
    expect(readStoredRecentScopes(mockStore)).toHaveLength(1);
  });

  it('handles store.get throwing (e.g. sandboxed iframe SecurityError)', () => {
    (mockStore.get as jest.Mock).mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(readStoredRecentScopes(mockStore)).toEqual([]);
  });

  it('strips scopeNodeId when version does not match current build', () => {
    const data: StoredRecentScopeSet[] = [{ scopeIds: ['scope-a'], scopeNodeId: 'node-1', version: 'old-version' }];
    (mockStore.get as jest.Mock).mockReturnValue(JSON.stringify(data));
    const result = readStoredRecentScopes(mockStore);
    expect(result).toHaveLength(1);
    expect(result[0].scopeNodeId).toBeUndefined();
    expect(result[0].scopeIds).toEqual(['scope-a']);
  });

  it('preserves scopeNodeId when version matches current build', () => {
    const data = [{ scopeIds: ['scope-a'], scopeNodeId: 'node-1', version: '10.0.0' }];
    (mockStore.get as jest.Mock).mockReturnValue(JSON.stringify(data));
    const result = readStoredRecentScopes(mockStore);
    expect(result[0].scopeNodeId).toBe('node-1');
  });

  it('preserves valid multi-scope entries', () => {
    const data = [{ scopeIds: ['scope-a', 'scope-b'], version: '10.0.0' }];
    (mockStore.get as jest.Mock).mockReturnValue(JSON.stringify(data));
    const result = readStoredRecentScopes(mockStore);
    expect(result).toHaveLength(1);
    expect(result[0].scopeIds).toEqual(['scope-a', 'scope-b']);
  });
});

describe('writeRecentScope', () => {
  const dispatchEventSpy = jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true);

  beforeEach(() => {
    jest.clearAllMocks();
    (mockStore.get as jest.Mock).mockReturnValue('[]');
  });

  afterAll(() => {
    dispatchEventSpy.mockRestore();
  });

  it('stores a new entry with correct shape', () => {
    writeRecentScope(mockStore, [makeScope('scope-a')]);
    const stored = JSON.parse((mockStore.set as jest.Mock).mock.calls[0][1]);
    expect(stored).toHaveLength(1);
    expect(stored[0].scopeIds).toEqual(['scope-a']);
    expect(stored[0].version).toBe('10.0.0');
  });

  it('dispatches RECENT_SCOPES_CHANGED_EVENT on write', () => {
    writeRecentScope(mockStore, [makeScope('scope-a')]);
    expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
    const event = dispatchEventSpy.mock.calls[0][0] as Event;
    expect(event.type).toBe(RECENT_SCOPES_CHANGED_EVENT);
  });

  it('does not write when scopes array is empty', () => {
    writeRecentScope(mockStore, []);
    expect(mockStore.set).not.toHaveBeenCalled();
    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });

  it('deduplicates by fingerprint (same scopeIds in any order)', () => {
    const existing = [{ scopeIds: ['scope-b', 'scope-a'], version: '10.0.0' }];
    (mockStore.get as jest.Mock).mockReturnValue(JSON.stringify(existing));
    writeRecentScope(mockStore, [makeScope('scope-a'), makeScope('scope-b')]);
    const stored = JSON.parse((mockStore.set as jest.Mock).mock.calls[0][1]);
    expect(stored).toHaveLength(1);
    expect(stored[0].scopeIds).toEqual(['scope-a', 'scope-b']);
  });

  it('caps at RECENT_SCOPES_MAX entries', () => {
    const existing = Array.from({ length: RECENT_SCOPES_MAX }, (_, i) => ({
      scopeIds: [`scope-${i}`],
      version: '10.0.0',
    }));
    (mockStore.get as jest.Mock).mockReturnValue(JSON.stringify(existing));
    writeRecentScope(mockStore, [makeScope('scope-new')]);
    const stored = JSON.parse((mockStore.set as jest.Mock).mock.calls[0][1]);
    expect(stored).toHaveLength(RECENT_SCOPES_MAX);
    expect(stored[0].scopeIds).toEqual(['scope-new']);
  });

  it('omits scopeNodeId when scope has a defaultPath', () => {
    writeRecentScope(mockStore, [makeScope('scope-a', ['parent', 'leaf'])], 'leaf-node');
    const stored = JSON.parse((mockStore.set as jest.Mock).mock.calls[0][1]);
    expect(stored[0].scopeNodeId).toBeUndefined();
  });

  it('stores scopeNodeId when scope lacks a defaultPath', () => {
    writeRecentScope(mockStore, [makeScope('scope-a')], 'leaf-node');
    const stored = JSON.parse((mockStore.set as jest.Mock).mock.calls[0][1]);
    expect(stored[0].scopeNodeId).toBe('leaf-node');
  });

  it('silently does nothing when store.set throws (e.g. sandboxed iframe)', () => {
    (mockStore.set as jest.Mock).mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(() => writeRecentScope(mockStore, [makeScope('scope-a')])).not.toThrow();
    expect(dispatchEventSpy).not.toHaveBeenCalled();
  });
});
