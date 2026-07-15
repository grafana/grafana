import { LoadingState, isLoadingStateComplete, isLoadingStateInProgress } from './data';

describe('LoadingState helpers', () => {
  it.each([
    [LoadingState.NotStarted, false, false],
    [LoadingState.Loading, true, false],
    [LoadingState.Streaming, true, false],
    [LoadingState.PartialResult, true, false],
    [LoadingState.Done, false, true],
    [LoadingState.Error, false, true],
  ])('classifies %s as inProgress=%s and complete=%s', (state, inProgress, complete) => {
    expect(isLoadingStateInProgress(state)).toBe(inProgress);
    expect(isLoadingStateComplete(state)).toBe(complete);
  });
});
