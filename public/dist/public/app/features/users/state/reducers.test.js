import { __assign } from "tslib";
import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { initialState, inviteesLoaded, setUsersSearchQuery, usersLoaded, usersReducer } from './reducers';
import { getMockInvitees, getMockUsers } from '../__mocks__/userMocks';
describe('usersReducer', function () {
    describe('when usersLoaded is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(usersReducer, __assign({}, initialState))
                .whenActionIsDispatched(usersLoaded(getMockUsers(1)))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { users: getMockUsers(1), hasFetched: true }));
        });
    });
    describe('when inviteesLoaded is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(usersReducer, __assign({}, initialState))
                .whenActionIsDispatched(inviteesLoaded(getMockInvitees(1)))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { invitees: getMockInvitees(1), hasFetched: true }));
        });
    });
    describe('when setUsersSearchQuery is dispatched', function () {
        it('then state should be correct', function () {
            reducerTester()
                .givenReducer(usersReducer, __assign({}, initialState))
                .whenActionIsDispatched(setUsersSearchQuery('a query'))
                .thenStateShouldEqual(__assign(__assign({}, initialState), { searchQuery: 'a query' }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map