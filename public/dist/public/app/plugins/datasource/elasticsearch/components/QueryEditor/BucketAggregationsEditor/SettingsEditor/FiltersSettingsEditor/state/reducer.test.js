import { reducerTester } from 'test/core/redux/reducerTester';
import { addFilter, changeFilter, removeFilter } from './actions';
import { reducer } from './reducer';
describe('Filters Bucket Aggregation Settings Reducer', function () {
    it('Should correctly add new filter', function () {
        reducerTester()
            .givenReducer(reducer, [])
            .whenActionIsDispatched(addFilter())
            .thenStatePredicateShouldEqual(function (state) { return state.length === 1; });
    });
    it('Should correctly remove filters', function () {
        var firstFilter = {
            label: 'First',
            query: '*',
        };
        var secondFilter = {
            label: 'Second',
            query: '*',
        };
        reducerTester()
            .givenReducer(reducer, [firstFilter, secondFilter])
            .whenActionIsDispatched(removeFilter(0))
            .thenStateShouldEqual([secondFilter]);
    });
    it("Should correctly change filter's attributes", function () {
        var firstFilter = {
            label: 'First',
            query: '*',
        };
        var secondFilter = {
            label: 'Second',
            query: '*',
        };
        var expectedSecondFilter = {
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