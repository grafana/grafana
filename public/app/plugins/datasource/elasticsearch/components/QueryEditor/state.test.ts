import { reducerTester } from 'test/core/redux/reducerTester';
import { ElasticsearchQuery } from '../../types';
import {
  aliasPatternReducer,
  changeAliasPattern,
  changeIndexPatternOverride,
  changeQuery,
  indexPatternOverrideReducer,
  queryReducer,
  initQuery,
} from './state';

describe('Query Reducer', () => {
  describe('On Init', () => {
    it('Should maintain the previous `query` if present', () => {
      const initialQuery: ElasticsearchQuery['query'] = 'Some lucene query';

      reducerTester<ElasticsearchQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(initQuery())
        .thenStateShouldEqual(initialQuery);
    });

    it('Should set an empty `query` if it is not already set', () => {
      const initialQuery: ElasticsearchQuery['query'] = undefined;
      const expectedQuery = '';

      reducerTester<ElasticsearchQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(initQuery())
        .thenStateShouldEqual(expectedQuery);
    });
  });

  it('Should correctly set `query`', () => {
    const expectedQuery: ElasticsearchQuery['query'] = 'Some lucene query';

    reducerTester<ElasticsearchQuery['query']>()
      .givenReducer(queryReducer, '')
      .whenActionIsDispatched(changeQuery(expectedQuery))
      .thenStateShouldEqual(expectedQuery);
  });

  it('Should not change state with other action types', () => {
    const initialState: ElasticsearchQuery['query'] = 'Some lucene query';

    reducerTester<ElasticsearchQuery['query']>()
      .givenReducer(queryReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});

describe('Alias Pattern Reducer', () => {
  it('Should correctly set `alias`', () => {
    const expectedAlias: ElasticsearchQuery['alias'] = 'Some alias pattern';

    reducerTester<ElasticsearchQuery['query']>()
      .givenReducer(aliasPatternReducer, '')
      .whenActionIsDispatched(changeAliasPattern(expectedAlias))
      .thenStateShouldEqual(expectedAlias);
  });

  it('Should not change state with other action types', () => {
    const initialState: ElasticsearchQuery['alias'] = 'Some alias pattern';

    reducerTester<ElasticsearchQuery['query']>()
      .givenReducer(aliasPatternReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});

describe('Index Pattern Override Reducer', () => {
  it('Should correctly set `indexPatternOverride`', () => {
    const expectedIndexPatternOverride: ElasticsearchQuery['indexPatternOverride'] = 'example-*';

    reducerTester()
      .givenReducer(indexPatternOverrideReducer, '')
      .whenActionIsDispatched(changeIndexPatternOverride(expectedIndexPatternOverride))
      .thenStateShouldEqual(expectedIndexPatternOverride);
  });

  it('Should not change state with other action types', () => {
    const initialState: ElasticsearchQuery['indexPatternOverride'] = 'example-*';

    reducerTester()
      .givenReducer(indexPatternOverrideReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });
});
