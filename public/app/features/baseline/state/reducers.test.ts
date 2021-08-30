import { reducerTester } from '../../../../test/core/redux/reducerTester';
import {
  initialBaselineEntryState,
  setUpdating,
  baselineReducer,
  BaselineEntryState,
  baselineEntriesLoaded,
} from './reducers';

describe('baselineReducer', () => {
  let dateNow: any;

  beforeAll(() => {
    dateNow = jest.spyOn(Date, 'now').mockImplementation(() => 1609470000000); // 2021-01-01 04:00:00
  });

  afterAll(() => {
    dateNow.mockRestore();
  });

  describe('when setUpdating is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<BaselineEntryState>()
        .givenReducer(baselineReducer, { ...initialBaselineEntryState, isUpdating: false })
        .whenActionIsDispatched(setUpdating({ updating: true }))
        .thenStateShouldEqual({ ...initialBaselineEntryState, isUpdating: true });
    });
  });

  describe('when baselineEntriesLoaded is dispatched', () => {
    it('then state should be correct', () => {
      reducerTester<BaselineEntryState>()
        .givenReducer(baselineReducer, { ...initialBaselineEntryState, baselineEntries: [] })
        .whenActionIsDispatched(
          baselineEntriesLoaded({
            baselineEntries: [],
          })
        )
        .thenStateShouldEqual({
          ...initialBaselineEntryState,
          baselineEntries: [],
        });
    });
  });
});
