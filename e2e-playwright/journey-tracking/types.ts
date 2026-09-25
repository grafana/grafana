export type JourneyOutcome = 'success' | 'timeout' | 'abandoned' | 'error' | 'discarded' | 'canceled';

export interface JourneyStepRecord {
  name: string;
  stepNumber: number;
  attributes?: Record<string, string>;
}

export interface JourneyRecord {
  journeyType: string;
  journeyId: string;
  outcome: JourneyOutcome;
  durationMs: number;
  stepCount: number;
  attributes: Record<string, string>;
  steps: JourneyStepRecord[];
  /** Attribute snapshots captured via setAttributes calls (in order) */
  attributeUpdates: Array<Record<string, string>>;
  /** Concurrent journey info from start event */
  concurrentJourneys: number;
  /** Raw console messages for debugging failures */
  rawLogs: string[];
}

export interface JourneyRecorder {
  /**
   * Wait for a journey of the given type to complete (reach any end state).
   * Resolves with the full JourneyRecord. Rejects after timeoutMs.
   */
  waitForJourneyEnd(journeyType: string, timeoutMs?: number): Promise<JourneyRecord>;

  /**
   * Wait for a journey to start. Resolves with the journeyId.
   * Useful for asserting journey-started-then-discarded flows.
   */
  waitForJourneyStart(journeyType: string, timeoutMs?: number): Promise<string>;

  /**
   * Get all completed journeys captured so far (already ended).
   */
  getCompletedJourneys(): JourneyRecord[];

  /**
   * Get all journey events captured so far (for debugging).
   */
  getRawLogs(): string[];

  /**
   * Clean up the console listener. Called automatically if using the fixture.
   */
  dispose(): void;
}
