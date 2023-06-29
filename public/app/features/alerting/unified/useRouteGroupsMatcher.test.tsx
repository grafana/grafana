import { renderHook } from '@testing-library/react';
import * as comlink from 'comlink';
import React from 'react';
import { Features } from 'react-enable';
import { FeatureDescription } from 'react-enable/dist/FeatureState';

import { createWorker } from './createRouteGroupsMatcherWorker';
import { AlertingFeature } from './features';
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
  it('should not load web worker if the feature flag is disabled', function () {
    const featureFlag = getInstancePreviewFeature(false);

    const { result } = renderHook(() => useRouteGroupsMatcher(), {
      wrapper: ({ children }) => <Features features={[featureFlag]}>{children}</Features>,
    });

    expect(createWorkerMock).not.toHaveBeenCalled();
    expect(wrapMock).not.toHaveBeenCalled();
    expect(result.current.getRouteGroupsMap).toBeDefined();
  });

  it('should load web worker if the feature flag is enabled', function () {
    const featureFlag = getInstancePreviewFeature(true);

    const { result } = renderHook(() => useRouteGroupsMatcher(), {
      wrapper: ({ children }) => <Features features={[featureFlag]}>{children}</Features>,
    });

    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    expect(wrapMock).toHaveBeenCalledTimes(1);
    expect(result.current.getRouteGroupsMap).toBeDefined();
  });

  it('getMatchedRouteGroups should throw error if loading worker failed', async function () {
    const featureFlag = getInstancePreviewFeature(true);
    createWorkerMock.mockImplementation(() => {
      throw new DOMException('Failed to load worker');
    });

    const { result } = renderHook(() => useRouteGroupsMatcher(), {
      wrapper: ({ children }) => <Features features={[featureFlag]}>{children}</Features>,
    });

    expect(createWorkerMock).toHaveBeenCalledTimes(1);
    expect(wrapMock).toHaveBeenCalledTimes(0); // When loading worker failed we shouldn't call wrap
    expect(async () => {
      await result.current.getRouteGroupsMap({ id: '1' }, []);
    }).rejects.toThrowError(Error);
  });
});

function getInstancePreviewFeature(enabled: boolean): FeatureDescription {
  return {
    name: AlertingFeature.NotificationPoliciesV2MatchingInstances,
    defaultValue: enabled,
  };
}
