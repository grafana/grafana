import { renderHook } from 'test/test-utils';

import { type UnifiedAlertingConfig } from '@grafana/data';
import { config } from '@grafana/runtime';

import {
  StateHistoryImplementation,
  checkEvaluationIntervalGlobalLimit,
  getStateHistoryImplementation,
  isStateHistoryAvailable,
  useIsStateHistoryAvailable,
  useStateHistoryImplementation,
} from './config';

describe('checkEvaluationIntervalGlobalLimit', () => {
  it('should NOT exceed limit if evaluate every is not valid duration', () => {
    config.unifiedAlerting.minInterval = '2m30s';

    const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit('123notvalidduration');

    expect(globalLimit).toBe(150 * 1000);
    expect(exceedsLimit).toBe(false);
  });

  it('should NOT exceed limit if config minInterval is not valid duration', () => {
    config.unifiedAlerting.minInterval = '1A8IU3A';

    const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit('1m30s');

    expect(globalLimit).toBe(0);
    expect(exceedsLimit).toBe(false);
  });

  it.each([
    ['2m30s', '1m30s'],
    ['30s', '10s'],
    ['1d2h', '2h'],
    ['1y', '90d'],
  ])(
    'should exceed limit if config minInterval (%s) is greater than evaluate every (%s)',
    (minInterval, evaluateEvery) => {
      config.unifiedAlerting.minInterval = minInterval;

      const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit(evaluateEvery);

      expect(globalLimit).toBeGreaterThan(0);
      expect(exceedsLimit).toBe(true);
    }
  );

  it.each([
    ['1m30s', '2m30s'],
    ['30s', '1d'],
    ['1m10s', '1h30m15s'],
  ])('should NOT exceed limit if config minInterval is lesser than evaluate every', (minInterval, evaluateEvery) => {
    config.unifiedAlerting.minInterval = minInterval;

    const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit(evaluateEvery);

    expect(globalLimit).toBeGreaterThan(0);
    expect(exceedsLimit).toBe(false);
  });
});

describe('getStateHistoryImplementation', () => {
  function settings(overrides: Partial<UnifiedAlertingConfig>): UnifiedAlertingConfig {
    return { minInterval: '10s', ...overrides };
  }

  it.each([
    { name: 'loki backend', stateHistory: { backend: 'loki' } },
    { name: 'loki backend with surrounding whitespace and casing', stateHistory: { backend: ' LoKi ' } },
    { name: 'loki as the multi primary', stateHistory: { backend: 'multiple', primary: 'loki' } },
  ])('uses the loki view for $name', ({ stateHistory }) => {
    expect(getStateHistoryImplementation(settings({ stateHistory }))).toBe(StateHistoryImplementation.Loki);
  });

  it.each([
    { name: 'annotations backend', stateHistory: { backend: 'annotations' } },
    // loki configured as a secondary looks the same here: only the primary answers queries
    { name: 'annotations as the multi primary', stateHistory: { backend: 'multiple', primary: 'annotations' } },
  ])('uses the annotations view for $name', ({ stateHistory }) => {
    expect(getStateHistoryImplementation(settings({ stateHistory }))).toBe(StateHistoryImplementation.Annotations);
  });

  it.each([
    // Grafana sends no state history settings when history is turned off
    { name: 'no state history configured', stateHistory: undefined },
    { name: 'prometheus backend', stateHistory: { backend: 'prometheus' } },
    { name: 'prometheus as the multi primary', stateHistory: { backend: 'multiple', primary: 'prometheus' } },
    { name: 'noop backend', stateHistory: { backend: 'noop' } },
    { name: 'multiple backend without a primary', stateHistory: { backend: 'multiple' } },
    // a backend name we do not know about, which happens when Grafana is newer than the frontend
    { name: 'an unrecognized backend', stateHistory: { backend: 'something-new' } },
    { name: 'an unrecognized multi primary', stateHistory: { backend: 'multiple', primary: 'something-new' } },
  ])('reports history as unavailable for $name', ({ stateHistory }) => {
    expect(getStateHistoryImplementation(settings({ stateHistory }))).toBe(StateHistoryImplementation.Unavailable);
  });

  // Grafana only started sending the nested stateHistory object in 12.4. An older Grafana sends
  // the flat fields instead, and must not be mistaken for history being turned off.
  describe('when talking to a Grafana that only sends the deprecated flat settings', () => {
    it('uses the loki view for a loki backend', () => {
      expect(getStateHistoryImplementation(settings({ alertStateHistoryBackend: 'loki' }))).toBe(
        StateHistoryImplementation.Loki
      );
    });

    it('uses the loki view for loki as the multi primary', () => {
      expect(
        getStateHistoryImplementation(
          settings({ alertStateHistoryBackend: 'multiple', alertStateHistoryPrimary: 'loki' })
        )
      ).toBe(StateHistoryImplementation.Loki);
    });

    it('uses the annotations view for an annotations backend', () => {
      expect(getStateHistoryImplementation(settings({ alertStateHistoryBackend: 'annotations' }))).toBe(
        StateHistoryImplementation.Annotations
      );
    });
  });
});

describe('isStateHistoryAvailable', () => {
  it.each([{ backend: 'loki' }, { backend: 'annotations' }, { backend: 'multiple', primary: 'loki' }])(
    'is true when a backend can answer history queries: %j',
    (stateHistory) => {
      expect(isStateHistoryAvailable({ minInterval: '10s', stateHistory })).toBe(true);
    }
  );

  it.each([{ backend: 'prometheus' }, { backend: 'noop' }, { backend: 'something-new' }, undefined])(
    'is false when no backend can answer history queries: %j',
    (stateHistory) => {
      expect(isStateHistoryAvailable({ minInterval: '10s', stateHistory })).toBe(false);
    }
  );
});

describe('useStateHistoryImplementation', () => {
  const originalStateHistory = config.unifiedAlerting.stateHistory;

  afterEach(() => {
    config.unifiedAlerting.stateHistory = originalStateHistory;
  });

  it.each([
    { stateHistory: { backend: 'loki' }, expected: StateHistoryImplementation.Loki },
    { stateHistory: { backend: 'annotations' }, expected: StateHistoryImplementation.Annotations },
    { stateHistory: { backend: 'prometheus' }, expected: StateHistoryImplementation.Unavailable },
  ])('reads the configured backend: $stateHistory.backend', ({ stateHistory, expected }) => {
    config.unifiedAlerting.stateHistory = stateHistory;

    const { result } = renderHook(() => useStateHistoryImplementation());

    expect(result.current).toBe(expected);
  });
});

describe('useIsStateHistoryAvailable', () => {
  const originalStateHistory = config.unifiedAlerting.stateHistory;

  afterEach(() => {
    config.unifiedAlerting.stateHistory = originalStateHistory;
  });

  it('is true when a backend can answer history queries', () => {
    config.unifiedAlerting.stateHistory = { backend: 'loki' };

    const { result } = renderHook(() => useIsStateHistoryAvailable());

    expect(result.current).toBe(true);
  });

  it('is false when no backend can answer history queries', () => {
    config.unifiedAlerting.stateHistory = { backend: 'prometheus' };

    const { result } = renderHook(() => useIsStateHistoryAvailable());

    expect(result.current).toBe(false);
  });
});
