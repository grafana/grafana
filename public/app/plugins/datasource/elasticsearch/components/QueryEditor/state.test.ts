import { ElasticsearchDataQuery } from '../../dataquery.gen';
import { reducerTester } from '../reducerTester';

import {
  aliasPatternReducer,
  changeAliasPattern,
  changeEditorTypeAndResetQuery,
  changeQuery,
  initQuery,
  queryReducer,
  rawDSLQueryReducer,
} from './state';

describe('Query Reducer', () => {
  describe('On Init', () => {
    it('Should maintain the previous `query` if present', () => {
      const initialQuery: ElasticsearchDataQuery['query'] = 'Some lucene query';

      reducerTester<ElasticsearchDataQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(initQuery())
        .thenStateShouldEqual(initialQuery);
    });

    it('Should set an empty `query` if it is not already set', () => {
      const initialQuery: ElasticsearchDataQuery['query'] = undefined;
      const expectedQuery = '';

      reducerTester<ElasticsearchDataQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(initQuery())
        .thenStateShouldEqual(expectedQuery);
    });
  });

  it('Should correctly set `query`', () => {
    const expectedQuery: ElasticsearchDataQuery['query'] = 'Some lucene query';

    reducerTester<ElasticsearchDataQuery['query']>()
      .givenReducer(queryReducer, '')
      .whenActionIsDispatched(changeQuery(expectedQuery))
      .thenStateShouldEqual(expectedQuery);
  });

  it('Should not change state with other action types', () => {
    const initialState: ElasticsearchDataQuery['query'] = 'Some lucene query';

    reducerTester<ElasticsearchDataQuery['query']>()
      .givenReducer(queryReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });

  describe('When switching editor type', () => {
    it('Should clear query when switching editor types', () => {
      const initialQuery: ElasticsearchDataQuery['query'] = 'Some lucene query';

      reducerTester<ElasticsearchDataQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(changeEditorTypeAndResetQuery('code'))
        .thenStateShouldEqual('');
    });
  });
});

describe('Alias Pattern Reducer', () => {
  it('Should correctly set `alias`', () => {
    const expectedAlias: ElasticsearchDataQuery['alias'] = 'Some alias pattern';

    reducerTester<ElasticsearchDataQuery['query']>()
      .givenReducer(aliasPatternReducer, '')
      .whenActionIsDispatched(changeAliasPattern(expectedAlias))
      .thenStateShouldEqual(expectedAlias);
  });

  it('Should not change state with other action types', () => {
    const initialState: ElasticsearchDataQuery['alias'] = 'Some alias pattern';

    reducerTester<ElasticsearchDataQuery['query']>()
      .givenReducer(aliasPatternReducer, initialState)
      .whenActionIsDispatched({ type: 'THIS ACTION SHOULD NOT HAVE ANY EFFECT IN THIS REDUCER' })
      .thenStateShouldEqual(initialState);
  });

  describe('When switching editor type', () => {
    it('Should clear alias when switching editor types', () => {
      const initialAlias: ElasticsearchDataQuery['alias'] = 'Some alias pattern';

      reducerTester<ElasticsearchDataQuery['alias']>()
        .givenReducer(aliasPatternReducer, initialAlias)
        .whenActionIsDispatched(changeEditorTypeAndResetQuery('code'))
        .thenStateShouldEqual('');
    });
  });
});

describe('Raw DSL Query Reducer', () => {
  it('Should clear raw DSL query when switching editor types', () => {
    const initialRawQuery: ElasticsearchDataQuery['rawDSLQuery'] = '{"query": {"match_all": {}}}';

    reducerTester<ElasticsearchDataQuery['rawDSLQuery']>()
      .givenReducer(rawDSLQueryReducer, initialRawQuery)
      .whenActionIsDispatched(changeEditorTypeAndResetQuery('builder'))
      .thenStateShouldEqual('');
  });
});
