import { fetchPromRulesAction } from './actions';
import reducer from './reducers';

describe('unified alerting reducers', () => {
  it('tracks async thunk lifecycle actions by their shared type prefix', () => {
    const arg = { rulesSourceName: 'grafana' };
    const loading = reducer(undefined, fetchPromRulesAction.pending('request-1', arg));

    expect(loading.promRules.grafana).toEqual({
      result: undefined,
      loading: true,
      error: undefined,
      dispatched: true,
      requestId: 'request-1',
    });

    const result = [{ dataSourceName: 'grafana', name: 'namespace', groups: [] }];
    const loaded = reducer(loading, fetchPromRulesAction.fulfilled(result, 'request-1', arg));

    expect(loaded.promRules.grafana).toEqual({
      ...loading.promRules.grafana,
      result,
      loading: false,
      error: undefined,
    });
  });
});
