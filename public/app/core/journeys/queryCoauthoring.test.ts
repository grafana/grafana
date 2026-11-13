import type { JourneyHandle, JourneyTracker } from '@grafana/runtime';

import type { JourneyRegistryImpl } from '../services/journey/JourneyRegistryImpl';
import { JOURNEY_REGISTRY } from '../services/journey/journeyRegistry';

import {
  interactionCallbacks,
  simulateInteraction,
  createMockHandle,
  createMockTracker,
  setupJourneyTest,
} from './__test-utils__/journeyTestHarness';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  onInteraction: (name: string, callback: (properties: Record<string, unknown>) => void) => {
    const callbacks = interactionCallbacks.get(name) ?? new Set();
    callbacks.add(callback);
    interactionCallbacks.set(name, callbacks);
    return () => callbacks.delete(callback);
  },
}));

let tracker: jest.Mocked<JourneyTracker>;
let handle: jest.Mocked<JourneyHandle>;
let registry: JourneyRegistryImpl;
beforeEach(() => {
  handle = createMockHandle('query_coauthoring');
  tracker = createMockTracker();
  tracker.startJourney.mockReturnValue(handle);
  registry = setupJourneyTest(tracker);
  jest.isolateModules(() => require('./queryCoauthoring'));
});
afterEach(() => registry.destroy());
const emit = (name: string, sessionId = 'session-1', attributes = {}) =>
  simulateInteraction(`grafana_query_coauthoring_${name}`, { sessionId, ...attributes });

it('measures entry and first preview outcome for the matching session', () => {
  emit('opened_popover', 'session-1', { source: 'highlight' });
  expect(tracker.startJourney).toHaveBeenCalledWith(
    'query_coauthoring',
    expect.objectContaining({ attributes: { sessionId: 'session-1', source: 'highlight' } })
  );
  expect(handle.startStep).toHaveBeenCalledWith('entry');
  emit('session_opened');
  expect(handle.startStep.mock.results[0].value.end).toHaveBeenCalledWith();
  emit('proposal_staged');
  expect(handle.startStep).toHaveBeenCalledWith('first_preview_outcome');
  emit('preview_outcome_shown', 'another-session', { kind: 'ok' });
  expect(handle.end).not.toHaveBeenCalled();
  emit('preview_outcome_shown', 'session-1', { kind: 'no-data' });
  expect(handle.startStep.mock.results[1].value.end).toHaveBeenCalledWith();
  expect(handle.end).toHaveBeenCalledWith('success');
});

it.each(['exit', 'replaced', 'left_panel_edit', 'flag_off', 'focus_removed'])(
  'discards an unfinished journey on %s',
  (reason) => {
    emit('opened_popover');
    emit('dismissed_popover', 'other', { reason });
    expect(handle.end).not.toHaveBeenCalled();
    emit('dismissed_popover', 'session-1', { reason });
    expect(handle.end).toHaveBeenCalledWith('discarded');
  }
);

it('ignores v1 events and does not restart an active journey', () => {
  simulateInteraction('grafana_query_coauthoring_opened_popover', {});
  expect(tracker.startJourney).not.toHaveBeenCalled();
  emit('opened_popover');
  tracker.getActiveJourney.mockReturnValue(handle);
  emit('opened_popover');
  expect(tracker.startJourney).toHaveBeenCalledTimes(1);
  expect(JOURNEY_REGISTRY.find((meta) => meta.type === 'query_coauthoring')?.parents).toEqual(['panel_edit']);
});

it('starts a new journey for a replacement session while ignoring the old session close', () => {
  emit('opened_popover');
  tracker.getActiveJourney.mockReturnValue(handle);
  const replacement = createMockHandle('query_coauthoring');
  tracker.startJourney.mockReturnValue(replacement);
  emit('opened_popover', 'session-2');
  expect(tracker.startJourney).toHaveBeenCalledTimes(2);
  emit('dismissed_popover', 'session-1');
  expect(replacement.end).not.toHaveBeenCalled();
  emit('proposal_staged', 'session-2');
  emit('preview_outcome_shown', 'session-2', { kind: 'ok' });
  expect(replacement.end).toHaveBeenCalledWith('success');
});
