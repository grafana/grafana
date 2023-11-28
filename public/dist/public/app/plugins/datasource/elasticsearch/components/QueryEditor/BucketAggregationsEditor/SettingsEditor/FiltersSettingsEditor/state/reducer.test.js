import { reducerTester } from 'test/core/redux/reducerTester';
import { addFilter, changeFilter, removeFilter } from './actions';
import { reducer } from './reducer';
describe('Filters Bucket Aggregation Settings Reducer', () => {
    it('Should correctly add new filter', () => {
        reducerTester()
            .givenReducer(reducer, [])
            .whenActionIsDispatched(addFilter())
            .thenStatePredicateShouldEqual((state) => state.length === 1);
    });
    it('Should correctly remove filters', () => {
        const firstFilter = {
            label: 'First',
            query: '*',
        };
        const secondFilter = {
            label: 'Second',
            query: '*',
        };
        reducerTester()
            .givenReducer(reducer, [firstFilter, secondFilter])
            .whenActionIsDispatched(removeFilter(0))
            .thenStateShouldEqual([secondFilter]);
    });
    it("Should correctly change filter's attributes", () => {
        const firstFilter = {
            label: 'First',
            query: '*',
        };
        const secondFilter = {
            label: 'Second',
            query: '*',
        };
        const expectedSecondFilter = {
            label: 'Changed label',
            query: 'Changed query',
        };
        reducerTester()
            .givenReducer(reducer, [firstFilter, secondFilter])
            .whenActionIsDispatched(changeFilter({ index: 1, filter: expectedSecondFilter }))
            .thenStateShouldEqual([firstFilter, expectedSecondFilter]);
    });
});
//# sourceMappingURL=reducer.test.js.map