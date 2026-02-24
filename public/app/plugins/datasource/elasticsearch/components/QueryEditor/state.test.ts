import { ElasticsearchDataQuery } from '../../dataquery.gen';
import { reducerTester } from '../reducerTester';

import { changeMetricType } from './MetricAggregationsEditor/state/actions';
import {
  aliasPatternReducer,
  changeAliasPattern,
  changeEditorTypeAndResetQuery,
  changeQuery,
  changeQueryType,
  initQuery,
  queryReducer,
  queryTypeReducer,
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

  describe('When switching query type', () => {
    it('Should clear query when switching from lucene to dsl', () => {
      const initialQuery: ElasticsearchDataQuery['query'] = 'field:value';

      reducerTester<ElasticsearchDataQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(changeQueryType('dsl'))
        .thenStateShouldEqual('');
    });

    it('Should clear query when switching from dsl to lucene', () => {
      const initialQuery: ElasticsearchDataQuery['query'] = '{"query": {"match_all": {}}}';

      reducerTester<ElasticsearchDataQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(changeQueryType('lucene'))
        .thenStateShouldEqual('');
    });
  });

  describe('When switching metric type', () => {
    it('Should clear query when switching from logs to metrics', () => {
      const initialQuery: ElasticsearchDataQuery['query'] = '{"query": {"match_all": {}}}';

      reducerTester<ElasticsearchDataQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(changeMetricType({ id: '1', type: 'avg' }))
        .thenStateShouldEqual('');
    });

    it('Should clear query when switching to raw_data', () => {
      const initialQuery: ElasticsearchDataQuery['query'] = 'field:value';

      reducerTester<ElasticsearchDataQuery['query']>()
        .givenReducer(queryReducer, initialQuery)
        .whenActionIsDispatched(changeMetricType({ id: '1', type: 'raw_data' }))
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

describe('Query Type Reducer', () => {
  it('Should correctly set queryType', () => {
    const expectedQueryType: ElasticsearchDataQuery['queryType'] = 'dsl';

    reducerTester<ElasticsearchDataQuery['queryType']>()
      .givenReducer(queryTypeReducer, 'lucene')
      .whenActionIsDispatched(changeQueryType(expectedQueryType))
      .thenStateShouldEqual(expectedQueryType);
  });

  it('Should set to lucene when switching to builder editor', () => {
    const initialQueryType: ElasticsearchDataQuery['queryType'] = 'dsl';

    reducerTester<ElasticsearchDataQuery['queryType']>()
      .givenReducer(queryTypeReducer, initialQueryType)
      .whenActionIsDispatched(changeEditorTypeAndResetQuery('builder'))
      .thenStateShouldEqual('lucene');
  });

  it('Should set to dsl when switching to code editor', () => {
    const initialQueryType: ElasticsearchDataQuery['queryType'] = 'lucene';

    reducerTester<ElasticsearchDataQuery['queryType']>()
      .givenReducer(queryTypeReducer, initialQueryType)
      .whenActionIsDispatched(changeEditorTypeAndResetQuery('code'))
      .thenStateShouldEqual('dsl');
  });

  it('Should default to lucene on init if not set', () => {
    const initialQueryType: ElasticsearchDataQuery['queryType'] = undefined;

    reducerTester<ElasticsearchDataQuery['queryType']>()
      .givenReducer(queryTypeReducer, initialQueryType)
      .whenActionIsDispatched(initQuery())
      .thenStateShouldEqual('lucene');
  });

  it('Should maintain queryType on init if already set', () => {
    const initialQueryType: ElasticsearchDataQuery['queryType'] = 'dsl';

    reducerTester<ElasticsearchDataQuery['queryType']>()
      .givenReducer(queryTypeReducer, initialQueryType)
      .whenActionIsDispatched(initQuery())
      .thenStateShouldEqual('dsl');
  });
});
