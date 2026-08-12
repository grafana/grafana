import { renderHook } from '@testing-library/react';

import { type Scope } from '@grafana/data';
import { type ScopeNode } from 'app/api/clients/scope/v0alpha1/endpoints.gen';

import { readStoredRecentScopes, type StoredRecentScopeSet } from './recentScopesStorage';
import { useRecentScopes } from './useRecentScopes';
import { useScopesById, useScopeNodesByName } from './useScopesApi';

// Mock the storage module so tests control what's "in localStorage"
jest.mock('./recentScopesStorage', () => ({
  ...jest.requireActual('./recentScopesStorage'),
  readStoredRecentScopes: jest.fn(),
}));
const mockReadStoredRecentScopes = jest.mocked(readStoredRecentScopes);

// Mock the API hooks so tests don't need a Redux store
jest.mock('./useScopesApi');
const mockUseScopesById = jest.mocked(useScopesById);
const mockUseScopeNodesByName = jest.mocked(useScopeNodesByName);

const mockScope = (id: string, title: string, defaultPath?: string[]): Scope => ({
  metadata: { name: id },
  spec: { title, filters: [], ...(defaultPath ? { defaultPath } : {}) },
});

const mockScopeNode = (name: string, title: string): ScopeNode => ({
  metadata: { name },
  spec: { title, nodeType: 'container', linkId: '', linkType: 'scope', disableMultiSelect: false },
});

describe('useRecentScopes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadStoredRecentScopes.mockReturnValue([]);
    mockUseScopesById.mockReturnValue({});
    mockUseScopeNodesByName.mockReturnValue({});
  });

  it('returns empty array when localStorage is empty', () => {
    mockReadStoredRecentScopes.mockReturnValue([]);
    const { result } = renderHook(() => useRecentScopes([]));
    expect(result.current).toEqual([]);
  });

  it('builds RecentScopeSet from stored IDs and fetched scope data', () => {
    const stored: StoredRecentScopeSet[] = [{ scopeIds: ['scope-a'], version: '1.0' }];
    mockReadStoredRecentScopes.mockReturnValue(stored);
    mockUseScopesById.mockReturnValue({ 'scope-a': mockScope('scope-a', 'Scope A') });

    const { result } = renderHook(() => useRecentScopes([]));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].scopeIds).toEqual(['scope-a']);
    expect(result.current[0].scopes).toEqual([{ id: 'scope-a', title: 'Scope A' }]);
    expect(result.current[0].parentNodeTitle).toBeUndefined();
  });

  it('filters out currently applied scopes', () => {
    const stored: StoredRecentScopeSet[] = [
      { scopeIds: ['scope-a'], version: '1.0' },
      { scopeIds: ['scope-b'], version: '1.0' },
    ];
    mockReadStoredRecentScopes.mockReturnValue(stored);
    mockUseScopesById.mockReturnValue({
      'scope-a': mockScope('scope-a', 'Scope A'),
      'scope-b': mockScope('scope-b', 'Scope B'),
    });

    const { result } = renderHook(() => useRecentScopes(['scope-a']));

    expect(result.current).toHaveLength(1);
    expect(result.current[0].scopeIds).toEqual(['scope-b']);
  });

  it('fetches parent node title from defaultPath[length-2]', () => {
    const stored: StoredRecentScopeSet[] = [{ scopeIds: ['scope-a'], version: '1.0' }];
    mockReadStoredRecentScopes.mockReturnValue(stored);
    mockUseScopesById.mockReturnValue({
      'scope-a': mockScope('scope-a', 'Scope A', ['', 'parent-node', 'leaf-node']),
    });
    mockUseScopeNodesByName.mockReturnValue({ 'parent-node': mockScopeNode('parent-node', 'Parent Category') });

    const { result } = renderHook(() => useRecentScopes([]));

    expect(result.current[0].parentNodeTitle).toBe('Parent Category');
  });

  it('returns undefined parentNodeTitle when scope has no defaultPath', () => {
    const stored: StoredRecentScopeSet[] = [{ scopeIds: ['scope-a'], scopeNodeId: 'leaf-node', version: '1.0' }];
    mockReadStoredRecentScopes.mockReturnValue(stored);
    mockUseScopesById.mockReturnValue({ 'scope-a': mockScope('scope-a', 'Scope A') });

    const { result } = renderHook(() => useRecentScopes([]));

    expect(result.current[0].parentNodeTitle).toBeUndefined();
    expect(result.current[0].scopeNodeId).toBe('leaf-node');
  });

  it('fetches leaf node when defaultPath has exactly one segment', () => {
    // defaultPath.length === 1 must also trigger a leaf node fetch so resolveParentNodeTitle
    // can read the leaf's parentName — previously length === 0 was the only gate.
    const stored: StoredRecentScopeSet[] = [{ scopeIds: ['scope-a'], scopeNodeId: 'leaf-node', version: '1.0' }];
    mockReadStoredRecentScopes.mockReturnValue(stored);
    mockUseScopesById.mockReturnValue({
      'scope-a': mockScope('scope-a', 'Scope A', ['leaf-node']),
    });
    mockUseScopeNodesByName.mockReturnValue({ 'leaf-node': mockScopeNode('leaf-node', 'Leaf') });

    renderHook(() => useRecentScopes([]));

    const calledWith = mockUseScopeNodesByName.mock.calls[0][0];
    expect(calledWith).toContain('leaf-node');
  });

  it('strips scopeNodeId when version is stale (handled by readStoredRecentScopes)', () => {
    const stored: StoredRecentScopeSet[] = [
      { scopeIds: ['scope-a'], version: 'old-version' },
      // Note: scopeNodeId is NOT present because readStoredRecentScopes stripped it
    ];
    mockReadStoredRecentScopes.mockReturnValue(stored);
    mockUseScopesById.mockReturnValue({ 'scope-a': mockScope('scope-a', 'Scope A') });

    const { result } = renderHook(() => useRecentScopes([]));

    expect(result.current[0].scopeNodeId).toBeUndefined();
  });

  it('passes all unique scope IDs to useScopesById', () => {
    const stored: StoredRecentScopeSet[] = [
      { scopeIds: ['scope-a', 'scope-b'], version: '1.0' },
      { scopeIds: ['scope-b', 'scope-c'], version: '1.0' },
    ];
    mockReadStoredRecentScopes.mockReturnValue(stored);

    renderHook(() => useRecentScopes([]));

    const calledWith = mockUseScopesById.mock.calls[0][0];
    expect(calledWith.sort()).toEqual(['scope-a', 'scope-b', 'scope-c']);
  });

  it('handles scope sets where scope data is not yet fetched', () => {
    const stored: StoredRecentScopeSet[] = [{ scopeIds: ['scope-a'], version: '1.0' }];
    mockReadStoredRecentScopes.mockReturnValue(stored);
    // Scope data not yet available
    mockUseScopesById.mockReturnValue({});

    const { result } = renderHook(() => useRecentScopes([]));

    expect(result.current[0].scopes).toEqual([]);
  });
});
