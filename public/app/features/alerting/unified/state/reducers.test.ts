import { reducerTester } from 'test/core/redux/reducerTester';

import { fetchGrafanaAnnotationsAction } from './actions';
import reducer, { type UnifiedAlertingState } from './reducers';

describe('managed alert state history', () => {
  it.each([
    {
      status: 'success',
      action: fetchGrafanaAnnotationsAction.fulfilled(
        { ruleUID: 'first-rule', history: [] },
        'first-request',
        'first-rule'
      ),
    },
    {
      status: 'failure',
      action: fetchGrafanaAnnotationsAction.rejected(new Error('History unavailable'), 'first-request', 'first-rule'),
    },
  ])('ignores a late $status from a previously viewed rule', ({ action }) => {
    const initialState = reducer(undefined, { type: 'init' });

    reducerTester<UnifiedAlertingState>()
      .givenReducer(reducer, initialState)
      .whenActionIsDispatched(fetchGrafanaAnnotationsAction.pending('first-request', 'first-rule'))
      .whenActionIsDispatched(fetchGrafanaAnnotationsAction.pending('second-request', 'second-rule'))
      .whenActionIsDispatched(action)
      .thenStateShouldEqual({
        ...initialState,
        managedAlertStateHistory: {
          requestId: 'second-request',
          loading: true,
          dispatched: true,
          result: undefined,
          error: undefined,
        },
      });
  });
});
