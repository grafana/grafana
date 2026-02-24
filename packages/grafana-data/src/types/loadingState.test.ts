import { LoadingState, isLoadingStateInProgress, isLoadingStateComplete } from './data';

describe('isLoadingStateInProgress', () => {
  it('should identify Loading as in-progress', () => {
    expect(isLoadingStateInProgress(LoadingState.Loading)).toBe(true);
  });

  it('should identify Streaming as in-progress', () => {
    expect(isLoadingStateInProgress(LoadingState.Streaming)).toBe(true);
  });

  it('should identify PartialResult as in-progress', () => {
    expect(isLoadingStateInProgress(LoadingState.PartialResult)).toBe(true);
  });

  it('should identify NotStarted as not in-progress', () => {
    expect(isLoadingStateInProgress(LoadingState.NotStarted)).toBe(false);
  });

  it('should identify Done as not in-progress', () => {
    expect(isLoadingStateInProgress(LoadingState.Done)).toBe(false);
  });

  it('should identify Error as not in-progress', () => {
    expect(isLoadingStateInProgress(LoadingState.Error)).toBe(false);
  });

  describe('use cases', () => {
    it('should help determine if query needs cancellation', () => {
      const states = [LoadingState.Loading, LoadingState.PartialResult, LoadingState.Streaming];
      const needsCancellation = states.filter(isLoadingStateInProgress);

      expect(needsCancellation).toHaveLength(3);
    });

    it('should help filter out completed queries', () => {
      const states = [
        LoadingState.Loading,
        LoadingState.Done,
        LoadingState.PartialResult,
        LoadingState.Error,
        LoadingState.Streaming,
      ];
      const inProgress = states.filter(isLoadingStateInProgress);

      expect(inProgress).toEqual([LoadingState.Loading, LoadingState.PartialResult, LoadingState.Streaming]);
    });
  });
});

describe('isLoadingStateComplete', () => {
  it('should identify Done as complete', () => {
    expect(isLoadingStateComplete(LoadingState.Done)).toBe(true);
  });

  it('should identify Error as complete', () => {
    expect(isLoadingStateComplete(LoadingState.Error)).toBe(true);
  });

  it('should identify Loading as not complete', () => {
    expect(isLoadingStateComplete(LoadingState.Loading)).toBe(false);
  });

  it('should identify Streaming as not complete', () => {
    expect(isLoadingStateComplete(LoadingState.Streaming)).toBe(false);
  });

  it('should identify PartialResult as not complete', () => {
    expect(isLoadingStateComplete(LoadingState.PartialResult)).toBe(false);
  });

  it('should identify NotStarted as not complete', () => {
    expect(isLoadingStateComplete(LoadingState.NotStarted)).toBe(false);
  });

  describe('use cases', () => {
    it('should help wait for query completion', () => {
      const states = [LoadingState.Loading, LoadingState.PartialResult, LoadingState.Done];
      const lastState = states[states.length - 1];

      expect(isLoadingStateComplete(lastState)).toBe(true);
    });

    it('should filter completed queries for processing', () => {
      const queryStates = [
        { id: 1, state: LoadingState.Loading },
        { id: 2, state: LoadingState.Done },
        { id: 3, state: LoadingState.PartialResult },
        { id: 4, state: LoadingState.Error },
      ];

      const completed = queryStates.filter((q) => isLoadingStateComplete(q.state));

      expect(completed).toHaveLength(2);
      expect(completed.map((q) => q.id)).toEqual([2, 4]);
    });
  });
});

describe('LoadingState semantics', () => {
  describe('PartialResult vs Streaming', () => {
    it('should treat both as in-progress', () => {
      expect(isLoadingStateInProgress(LoadingState.PartialResult)).toBe(true);
      expect(isLoadingStateInProgress(LoadingState.Streaming)).toBe(true);
    });

    it('should treat neither as complete', () => {
      expect(isLoadingStateComplete(LoadingState.PartialResult)).toBe(false);
      expect(isLoadingStateComplete(LoadingState.Streaming)).toBe(false);
    });

    it('should distinguish by completion expectation', () => {
      // PartialResult expects Done
      const partialFlow = [LoadingState.PartialResult, LoadingState.PartialResult, LoadingState.Done];
      expect(isLoadingStateComplete(partialFlow[partialFlow.length - 1])).toBe(true);

      // Streaming may never send Done
      const streamFlow = [LoadingState.Streaming, LoadingState.Streaming /* ... continues */];
      expect(streamFlow.every((s) => !isLoadingStateComplete(s))).toBe(true);
    });
  });

  describe('PartialResult use case: query splitting', () => {
    it('should handle multiple partial results before completion', () => {
      const queryResponses = [
        { data: [1, 2], state: LoadingState.Loading },
        { data: [1, 2, 3, 4], state: LoadingState.PartialResult }, // First chunk
        { data: [1, 2, 3, 4, 5, 6], state: LoadingState.PartialResult }, // Second chunk
        { data: [1, 2, 3, 4, 5, 6, 7, 8], state: LoadingState.Done }, // Final
      ];

      const inProgress = queryResponses.filter((r) => isLoadingStateInProgress(r.state));
      const complete = queryResponses.filter((r) => isLoadingStateComplete(r.state));

      expect(inProgress).toHaveLength(3);
      expect(complete).toHaveLength(1);
      expect(complete[0].state).toBe(LoadingState.Done);
    });
  });
});
