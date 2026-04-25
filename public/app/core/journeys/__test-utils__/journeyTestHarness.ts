import {
  type JourneyHandle,
  type JourneyTracker,
  type StepHandle,
  setJourneyTracker,
  setJourneyRegistry,
} from '@grafana/runtime';

import { JourneyRegistryImpl } from '../../services/JourneyRegistryImpl';
import { JOURNEY_REGISTRY } from '../../services/journeyRegistry';

/**
 * Shared interaction callback registry used by all journey wiring tests.
 *
 * Each test file must still call jest.mock('@grafana/runtime') at module scope
 * (jest.mock is hoisted), but can reference this map so the mock and the
 * simulateInteraction helper share the same callback store.
 */
export const interactionCallbacks = new Map<string, Set<(properties: Record<string, unknown>) => void>>();

/** Fire all registered callbacks for a given interaction name. */
export function simulateInteraction(name: string, properties: Record<string, unknown> = {}) {
  const callbacks = interactionCallbacks.get(name);
  if (callbacks) {
    for (const cb of callbacks) {
      cb(properties);
    }
  }
}

export function createMockStepHandle(): jest.Mocked<StepHandle> {
  return { end: jest.fn() };
}

export function createMockHandle(type: string): jest.Mocked<JourneyHandle> {
  return {
    journeyId: `mock-${type}-${Date.now()}`,
    traceId: `trace-${type}-${Date.now()}`,
    journeyType: type,
    isActive: true,
    recordEvent: jest.fn(),
    startStep: jest.fn().mockReturnValue(createMockStepHandle()),
    end: jest.fn(),
    setAttributes: jest.fn(),
    onEnd: jest.fn(),
  };
}

export function createMockTracker(): jest.Mocked<JourneyTracker> {
  return {
    startJourney: jest.fn(),
    getActiveJourney: jest.fn().mockReturnValue(null),
    cancelAll: jest.fn(),
  };
}

/**
 * Set up the journey registry and tracker for a test suite.
 * Returns the registry so the caller can destroy() it in afterEach.
 */
export function setupJourneyTest(mockTracker: jest.Mocked<JourneyTracker>): JourneyRegistryImpl {
  interactionCallbacks.clear();
  setJourneyTracker(mockTracker);

  const registry = new JourneyRegistryImpl();
  registry.init(JOURNEY_REGISTRY);
  setJourneyRegistry(registry);
  return registry;
}
