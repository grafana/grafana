import {
  LoadingState,
  isLoadingStateComplete,
  isLoadingStateIncremental,
  isLoadingStatePending,
  isLoadingStateRunning,
} from './data';

describe('LoadingState helpers', () => {
  it.each([
    [LoadingState.NotStarted, false, true, false, false],
    [LoadingState.Loading, true, true, false, false],
    [LoadingState.Streaming, true, true, true, false],
    [LoadingState.PartialResult, true, true, true, false],
    [LoadingState.Done, false, false, false, true],
    [LoadingState.Error, false, false, false, true],
  ])(
    'classifies %s as running=%s, pending=%s, incremental=%s, complete=%s',
    (state, running, pending, incremental, complete) => {
      expect(isLoadingStateRunning(state)).toBe(running);
      expect(isLoadingStatePending(state)).toBe(pending);
      expect(isLoadingStateIncremental(state)).toBe(incremental);
      expect(isLoadingStateComplete(state)).toBe(complete);
    }
  );
});
