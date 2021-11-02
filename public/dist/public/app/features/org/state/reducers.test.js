import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialState, organizationLoaded, organizationReducer, setOrganizationName } from './reducers';
describe('organizationReducer', function () {
    describe('when organizationLoaded is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(organizationReducer, __assign({}, initialState))
                .whenActionIsDispatched(organizationLoaded({ id: 1, name: 'An org' }))
                .thenStateShouldEqual({
                organization: { id: 1, name: 'An org' },
            });
        });
    });
    describe('when setOrganizationName is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(organizationReducer, __assign(__assign({}, initialState), { organization: { id: 1, name: 'An org' } }))
                .whenActionIsDispatched(setOrganizationName('New Name'))
                .thenStateShouldEqual({
                organization: { id: 1, name: 'New Name' },
            });
        });
    });
});
//# sourceMappingURL=reducers.test.js.map