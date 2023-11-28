import { reducerTester } from '../../../../test/core/redux/reducerTester';
import { getMockUsers, getFetchUsersMock } from '../__mocks__/userMocks';
import { initialState, searchQueryChanged, usersLoaded, usersReducer } from './reducers';
describe('usersReducer', () => {
    describe('when usersLoaded is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(usersReducer, Object.assign({}, initialState))
                .whenActionIsDispatched(usersLoaded(getFetchUsersMock(1)))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { users: getMockUsers(1), isLoading: true }));
        });
    });
    describe('when searchQueryChanged is dispatched', () => {
        it('then state should be correct', () => {
            reducerTester()
                .givenReducer(usersReducer, Object.assign({}, initialState))
                .whenActionIsDispatched(searchQueryChanged('a query'))
                .thenStateShouldEqual(Object.assign(Object.assign({}, initialState), { searchQuery: 'a query' }));
        });
    });
});
//# sourceMappingURL=reducers.test.js.map