import { LoadingState, isLoadingStateInProgress, isLoadingStateComplete } from './data';

describe('LoadingState', () => {
  it('has all defined values', () => {
    expect(LoadingState.NotStarted).toBe('NotStarted');
    expect(LoadingState.Loading).toBe('Loading');
    expect(LoadingState.Streaming).toBe('Streaming');
    expect(LoadingState.PartialResult).toBe('PartialResult');
    expect(LoadingState.Done).toBe('Done');
    expect(LoadingState.Error).toBe('Error');
  });

  it('should have PartialResult as a valid state', () => {
    const states = Object.values(LoadingState);
    expect(states).toContain('PartialResult');
    expect(states).toHaveLength(6);
  });

  describe('state semantics', () => {
    it('should treat PartialResult as in-progress (not done)', () => {
      const inProgressStates = [LoadingState.Loading, LoadingState.Streaming, LoadingState.PartialResult];
      const doneStates = [LoadingState.Done, LoadingState.Error];

      // PartialResult should be treated like Loading/Streaming
      expect(inProgressStates).toContain(LoadingState.PartialResult);
      expect(doneStates).not.toContain(LoadingState.PartialResult);
    });

    it('should distinguish PartialResult from Streaming', () => {
      // Both are in-progress states but serve different purposes
      expect(LoadingState.PartialResult).not.toBe(LoadingState.Streaming);

      // PartialResult: expects LoadingState.Done when complete
      // Streaming: may never send Done (continuous stream)
    });
  });

  describe('usage patterns', () => {
    it('should handle partial result workflow', () => {
      // Simulates query splitting or partial loading
      const states: LoadingState[] = [];

      // Start loading
      states.push(LoadingState.Loading);

      // Receive first partial result
      states.push(LoadingState.PartialResult);

      // Receive more partial results
      states.push(LoadingState.PartialResult);

      // All results received
      states.push(LoadingState.Done);

      expect(states).toHaveLength(4);
      expect(states[states.length - 1]).toBe(LoadingState.Done);
    });

    it('should distinguish from streaming workflow', () => {
      // Streaming may never send Done
      const streamingStates: LoadingState[] = [];

      streamingStates.push(LoadingState.Loading);
      streamingStates.push(LoadingState.Streaming);
      // ... continuous stream, no Done

      // PartialResult must end with Done
      const partialStates: LoadingState[] = [];

      partialStates.push(LoadingState.Loading);
      partialStates.push(LoadingState.PartialResult);
      partialStates.push(LoadingState.Done);

      expect(streamingStates).not.toContain(LoadingState.Done);
      expect(partialStates).toContain(LoadingState.Done);
    });
  });
});

describe('isLoadingStateInProgress', () => {
  it('should return true for Loading state', () => {
    expect(isLoadingStateInProgress(LoadingState.Loading)).toBe(true);
  });

  it('should return true for Streaming state', () => {
    expect(isLoadingStateInProgress(LoadingState.Streaming)).toBe(true);
  });

  it('should return true for PartialResult state', () => {
    expect(isLoadingStateInProgress(LoadingState.PartialResult)).toBe(true);
  });

  it('should return false for NotStarted state', () => {
    expect(isLoadingStateInProgress(LoadingState.NotStarted)).toBe(false);
  });

  it('should return false for Done state', () => {
    expect(isLoadingStateInProgress(LoadingState.Done)).toBe(false);
  });

  it('should return false for Error state', () => {
    expect(isLoadingStateInProgress(LoadingState.Error)).toBe(false);
  });
});

describe('isLoadingStateComplete', () => {
  it('should return true for Done state', () => {
    expect(isLoadingStateComplete(LoadingState.Done)).toBe(true);
  });

  it('should return true for Error state', () => {
    expect(isLoadingStateComplete(LoadingState.Error)).toBe(true);
  });

  it('should return false for NotStarted state', () => {
    expect(isLoadingStateComplete(LoadingState.NotStarted)).toBe(false);
  });

  it('should return false for Loading state', () => {
    expect(isLoadingStateComplete(LoadingState.Loading)).toBe(false);
  });

  it('should return false for Streaming state', () => {
    expect(isLoadingStateComplete(LoadingState.Streaming)).toBe(false);
  });

  it('should return false for PartialResult state', () => {
    expect(isLoadingStateComplete(LoadingState.PartialResult)).toBe(false);
  });
});
