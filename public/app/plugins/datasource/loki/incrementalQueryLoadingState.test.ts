import { LoadingState } from '@grafana/data';

import { getIncrementalSplitQueryLoadingState } from './incrementalQueryLoadingState';

describe('getIncrementalSplitQueryLoadingState', () => {
  it('returns PartialResult when LoadingState supports it', () => {
    expect('PartialResult' in LoadingState).toBe(true);
    expect(getIncrementalSplitQueryLoadingState()).toBe(LoadingState.PartialResult);
  });

  it('falls back to Streaming when PartialResult is not on LoadingState', () => {
    jest.isolateModules(() => {
      jest.doMock('@grafana/data', () => {
        const actual = jest.requireActual('@grafana/data');
        return {
          ...actual,
          LoadingState: {
            NotStarted: actual.LoadingState.NotStarted,
            Loading: actual.LoadingState.Loading,
            Streaming: actual.LoadingState.Streaming,
            Done: actual.LoadingState.Done,
            Error: actual.LoadingState.Error,
          },
        };
      });

      const { getIncrementalSplitQueryLoadingState: getState } = require('./incrementalQueryLoadingState');
      expect(getState()).toBe(LoadingState.Streaming);
    });
  });
});
