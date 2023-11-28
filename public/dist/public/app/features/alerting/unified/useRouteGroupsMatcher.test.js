import { __awaiter } from "tslib";
import { renderHook } from '@testing-library/react';
import * as comlink from 'comlink';
import React from 'react';
import { Features } from 'react-enable';
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
            wrapper: ({ children }) => React.createElement(Features, { features: [featureFlag] }, children),
        });
        expect(createWorkerMock).not.toHaveBeenCalled();
        expect(wrapMock).not.toHaveBeenCalled();
        expect(result.current.getRouteGroupsMap).toBeDefined();
    });
    it('should load web worker if the feature flag is enabled', function () {
        const featureFlag = getInstancePreviewFeature(true);
        const { result } = renderHook(() => useRouteGroupsMatcher(), {
            wrapper: ({ children }) => React.createElement(Features, { features: [featureFlag] }, children),
        });
        expect(createWorkerMock).toHaveBeenCalledTimes(1);
        expect(wrapMock).toHaveBeenCalledTimes(1);
        expect(result.current.getRouteGroupsMap).toBeDefined();
    });
    it('getMatchedRouteGroups should throw error if loading worker failed', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const featureFlag = getInstancePreviewFeature(true);
            createWorkerMock.mockImplementation(() => {
                throw new DOMException('Failed to load worker');
            });
            const { result } = renderHook(() => useRouteGroupsMatcher(), {
                wrapper: ({ children }) => React.createElement(Features, { features: [featureFlag] }, children),
            });
            expect(createWorkerMock).toHaveBeenCalledTimes(1);
            expect(wrapMock).toHaveBeenCalledTimes(0); // When loading worker failed we shouldn't call wrap
            expect(() => __awaiter(this, void 0, void 0, function* () {
                yield result.current.getRouteGroupsMap({ id: '1' }, []);
            })).rejects.toThrowError(Error);
        });
    });
});
function getInstancePreviewFeature(enabled) {
    return {
        name: AlertingFeature.NotificationPoliciesV2MatchingInstances,
        defaultValue: enabled,
    };
}
//# sourceMappingURL=useRouteGroupsMatcher.test.js.map