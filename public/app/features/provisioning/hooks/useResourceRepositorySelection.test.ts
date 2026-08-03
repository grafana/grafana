import { renderHook } from '@testing-library/react';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';

import { resourceKindInfos } from '../utils/resourceKinds';

import { useResourceRepositorySelection } from './useResourceRepositorySelection';

jest.mock('app/api/clients/provisioning/v0alpha1', () => ({
  useGetFrontendSettingsQuery: jest.fn(),
}));

const mockQuery = useGetFrontendSettingsQuery as jest.Mock;

const playlistAvailable = [{ group: 'playlist.grafana.app', kind: 'Playlist' }];
const repo = { name: 'r1', title: 'R1', target: 'instance', type: 'git', workflows: [] };

describe('useResourceRepositorySelection', () => {
  beforeEach(() => {
    config.featureToggles.provisioning = true;
    mockQuery.mockReturnValue({ data: undefined });
  });

  it('is unavailable when provisioning is disabled', () => {
    config.featureToggles.provisioning = false;
    const { result } = renderHook(() => useResourceRepositorySelection(resourceKindInfos.playlist));
    expect(result.current.isAvailable).toBe(false);
  });

  it('is unavailable when the kind is not declared in availableResources', () => {
    mockQuery.mockReturnValue({ data: { items: [repo], availableResources: [] } });
    const { result } = renderHook(() => useResourceRepositorySelection(resourceKindInfos.playlist));
    expect(result.current.isAvailable).toBe(false);
  });

  it('is unavailable when the kind is disabled in availableResources', () => {
    mockQuery.mockReturnValue({
      data: {
        items: [repo],
        availableResources: [{ group: 'playlist.grafana.app', kind: 'Playlist', disabled: true }],
      },
    });
    const { result } = renderHook(() => useResourceRepositorySelection(resourceKindInfos.playlist));
    expect(result.current.isAvailable).toBe(false);
  });

  it('is unavailable when no repositories are configured', () => {
    mockQuery.mockReturnValue({ data: { items: [], availableResources: playlistAvailable } });
    const { result } = renderHook(() => useResourceRepositorySelection(resourceKindInfos.playlist));
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.repositories).toEqual([]);
  });

  it('is available with the configured repositories when the kind is enabled and a repository exists', () => {
    mockQuery.mockReturnValue({ data: { items: [repo], availableResources: playlistAvailable } });
    const { result } = renderHook(() => useResourceRepositorySelection(resourceKindInfos.playlist));
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.repositories).toEqual([repo]);
  });
});
