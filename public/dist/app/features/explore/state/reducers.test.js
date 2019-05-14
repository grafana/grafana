import * as tslib_1 from "tslib";
import { itemReducer, makeExploreItemState } from './reducers';
import { ExploreId } from 'app/types/explore';
import { reducerTester } from 'test/core/redux/reducerTester';
import { scanStartAction, scanStopAction } from './actionTypes';
describe('Explore item reducer', function () {
    describe('scanning', function () {
        test('should start scanning', function () {
            var scanner = jest.fn();
            var initalState = tslib_1.__assign({}, makeExploreItemState(), { scanning: false, scanner: undefined });
            reducerTester()
                .givenReducer(itemReducer, initalState)
                .whenActionIsDispatched(scanStartAction({ exploreId: ExploreId.left, scanner: scanner }))
                .thenStateShouldEqual(tslib_1.__assign({}, makeExploreItemState(), { scanning: true, scanner: scanner }));
        });
        test('should stop scanning', function () {
            var scanner = jest.fn();
            var initalState = tslib_1.__assign({}, makeExploreItemState(), { scanning: true, scanner: scanner, scanRange: {} });
            reducerTester()
                .givenReducer(itemReducer, initalState)
                .whenActionIsDispatched(scanStopAction({ exploreId: ExploreId.left }))
                .thenStateShouldEqual(tslib_1.__assign({}, makeExploreItemState(), { scanning: false, scanner: undefined, scanRange: undefined }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map