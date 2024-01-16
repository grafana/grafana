import { renderHook } from '@testing-library/react';
import * as comlink from 'comlink';

import { createWorker } from './createRouteGroupsMatcherWorker';
import { useRouteGroupsMatcher } from './useRouteGroupsMatcher';

jest.mock('./createRouteGroupsMatcherWorker');
jest.mock('comlink');

const createWorkerMock = jest.mocked(createWorker);
const wrapMock = jest.mocked(comlink.wrap);

beforeEach(() => {
  createWorkerMock.mockReset();
  wrapMock.mockReset();
});

describe('useRouteGroupsMatcher', () => {
  it('should load web worker if the feature flag is enabled', function () {
    const { result } = renderHook(() => useRouteGroupsMatcher());

    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    expect(wrapMock).toHaveBeenCalledTimes(1);
    expect(result.current.getRouteGroupsMap).toBeDefined();
  });

  it('getMatchedRouteGroups should throw error if loading worker failed', async function () {
    createWorkerMock.mockImplementation(() => {
      throw new DOMException('Failed to load worker');
    });

    const { result } = renderHook(() => useRouteGroupsMatcher());

    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    expect(wrapMock).toHaveBeenCalledTimes(0); // When loading worker failed we shouldn't call wrap
    expect(async () => {
      await result.current.getRouteGroupsMap({ id: '1' }, []);
    }).rejects.toThrowError(Error);
  });
});
