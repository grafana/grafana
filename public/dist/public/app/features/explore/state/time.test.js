import { __assign } from "tslib";
import { dateTime, LoadingState } from '@grafana/data';
import { makeExplorePaneState } from './utils';
import { ExploreId } from 'app/types/explore';
import { reducerTester } from 'test/core/redux/reducerTester';
import { changeRangeAction, changeRefreshIntervalAction, timeReducer } from './time';
describe('Explore item reducer', function () {
    describe('changing refresh intervals', function () {
        it("should result in 'streaming' state, when live-tailing is active", function () {
            var initialState = makeExplorePaneState();
            var expectedState = __assign(__assign({}, initialState), { refreshInterval: 'LIVE', isLive: true, loading: true, logsResult: {
                    hasUniqueLabels: false,
                    rows: [],
                }, queryResponse: __assign(__assign({}, initialState.queryResponse), { state: LoadingState.Streaming }) });
            reducerTester()
                .givenReducer(timeReducer, initialState)
                .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId: ExploreId.left, refreshInterval: 'LIVE' }))
                .thenStateShouldEqual(expectedState);
        });
        it("should result in 'done' state, when live-tailing is stopped", function () {
            var initialState = makeExplorePaneState();
            var expectedState = __assign(__assign({}, initialState), { refreshInterval: '', logsResult: {
                    hasUniqueLabels: false,
                    rows: [],
                }, queryResponse: __assign(__assign({}, initialState.queryResponse), { state: LoadingState.Done }) });
            reducerTester()
                .givenReducer(timeReducer, initialState)
                .whenActionIsDispatched(changeRefreshIntervalAction({ exploreId: ExploreId.left, refreshInterval: '' }))
                .thenStateShouldEqual(expectedState);
        });
    });
    describe('changing range', function () {
        describe('when changeRangeAction is dispatched', function () {
            it('then it should set correct state', function () {
                reducerTester()
                    .givenReducer(timeReducer, {
                    range: null,
                    absoluteRange: null,
                })
                    .whenActionIsDispatched(changeRangeAction({
                    exploreId: ExploreId.left,
                    absoluteRange: { from: 1546297200000, to: 1546383600000 },
                    range: { from: dateTime('2019-01-01'), to: dateTime('2019-01-02'), raw: { from: 'now-1d', to: 'now' } },
                }))
                    .thenStateShouldEqual({
                    absoluteRange: { from: 1546297200000, to: 1546383600000 },
                    range: { from: dateTime('2019-01-01'), to: dateTime('2019-01-02'), raw: { from: 'now-1d', to: 'now' } },
                });
            });
        });
    });
});
//# sourceMappingURL=time.test.js.map