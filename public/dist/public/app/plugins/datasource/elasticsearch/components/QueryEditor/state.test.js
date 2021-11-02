import { reducerTester } from 'test/core/redux/reducerTester';
import { aliasPatternReducer, changeAliasPattern, changeQuery, initQuery, queryReducer } from './state';
describe('Query Reducer', function () {
    describe('On Init', function () {
        it('Should maintain the previous `query` if present', function () {
            var initialQuery = 'Some lucene query';
            reducerTester()
                .givenReducer(queryReducer, initialQuery)
                .whenActionIsDispatched(initQuery())
                .thenStateShouldEqual(initialQuery);
        });
        it('Should set an empty `query` if it is not already set', function () {
            var initialQuery = undefined;
            var expectedQuery = '';
            reducerTester()
                .givenReducer(queryReducer, initialQuery)
                .whenActionIsDispatched(initQuery())
                .thenStateShouldEqual(expectedQuery);
        });
    });
    it('Should correctly set `query`', function () {
        var expectedQuery = 'Some lucene query';
        reducerTester()
            .givenReducer(queryReducer, '')
            .whenActionIsDispatched(changeQuery(expectedQuery))
            .thenStateShouldEqual(expectedQuery);
    });
    it('Should not change state with other action types', function () {
        var initialState = 'Some lucene query';
        reducerTester()
            .givenReducer(queryReducer, initialState)
            .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
            .thenStateShouldEqual(initialState);
    });
});
describe('Alias Pattern Reducer', function () {
    it('Should correctly set `alias`', function () {
        var expectedAlias = 'Some alias pattern';
        reducerTester()
            .givenReducer(aliasPatternReducer, '')
            .whenActionIsDispatched(changeAliasPattern(expectedAlias))
            .thenStateShouldEqual(expectedAlias);
    });
    it('Should not change state with other action types', function () {
        var initialState = 'Some alias pattern';
        reducerTester()
            .givenReducer(aliasPatternReducer, initialState)
            .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
            .thenStateShouldEqual(initialState);
    });
});
//# sourceMappingURL=state.test.js.map