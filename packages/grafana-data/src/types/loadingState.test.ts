import { LoadingState, isLoadingStateComplete, isLoadingStateIncremental, isLoadingStateRunning } from './data';

describe('LoadingState helpers', () => {
  it.each([
    [LoadingState.NotStarted, false, false, false],
    [LoadingState.Loading, true, false, false],
    [LoadingState.Streaming, true, true, false],
    [LoadingState.PartialResult, true, true, false],
    [LoadingState.Done, false, false, true],
    [LoadingState.Error, false, false, true],
  ])('classifies %s as running=%s, incremental=%s, complete=%s', (state, running, incremental, complete) => {
    expect(isLoadingStateRunning(state)).toBe(running);
    expect(isLoadingStateIncremental(state)).toBe(incremental);
    expect(isLoadingStateComplete(state)).toBe(complete);
  });
});
