import type { JourneyHandle, JourneyTracker } from '@grafana/runtime';

import type { JourneyRegistryImpl } from '../services/journey/JourneyRegistryImpl';

import {
  interactionCallbacks,
  simulateInteraction,
  createMockHandle,
  createMockTracker,
  setupJourneyTest,
} from './__test-utils__/journeyTestHarness';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    onInteraction: (name: string, callback: (properties: Record<string, unknown>) => void) => {
      let set = interactionCallbacks.get(name);
      if (!set) {
        set = new Set();
        interactionCallbacks.set(name, set);
      }
      set.add(callback);
      return () => {
        set!.delete(callback);
        if (set!.size === 0) {
          interactionCallbacks.delete(name);
        }
      };
    },
  };
});

const CARD_CLICKED = 'grafana_homepage_cta_clicked';

describe('homeToAlertInsight journey wiring', () => {
  let mockTracker: jest.Mocked<JourneyTracker>;
  let mockHandle: jest.Mocked<JourneyHandle>;
  let registry: JourneyRegistryImpl;

  beforeEach(() => {
    mockHandle = createMockHandle('home_to_alert_insight');
    mockTracker = createMockTracker();
    mockTracker.startJourney.mockReturnValue(mockHandle);
    registry = setupJourneyTest(mockTracker);
  });

  afterEach(() => {
    registry.destroy();
  });

  function loadWiring() {
    jest.isolateModules(() => {
      require('./homeToAlertInsight');
    });
  }

  it('starts the journey for each of the four card actions with coerced attributes', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, {
      surface: 'alerts_card',
      action: 'alert_detail',
      placement: 'list',
      severity: 'critical',
      ms_since_load: 1500,
    });

    expect(mockTracker.startJourney).toHaveBeenCalledWith(
      'home_to_alert_insight',
      expect.objectContaining({
        attributes: {
          action: 'alert_detail',
          placement: 'list',
          severity: 'critical',
          msSinceLoad: '1500',
        },
      })
    );

    for (const action of ['view_all_alerts', 'view_all_rules', 'create_rule']) {
      simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action, placement: 'footer' });
      expect(mockTracker.startJourney).toHaveBeenCalledWith(
        'home_to_alert_insight',
        expect.objectContaining({
          attributes: expect.objectContaining({ action, placement: 'footer', severity: '', msSinceLoad: '' }),
        })
      );
    }
  });

  it('does not start the journey for an unknown card action', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'declare_incident', placement: 'footer' });

    expect(mockTracker.startJourney).not.toHaveBeenCalled();
  });

  it('ignores an unrelated interaction', () => {
    loadWiring();

    simulateInteraction('grafana_some_other_event', { foo: 'bar' });

    expect(mockTracker.startJourney).not.toHaveBeenCalled();
  });

  it('ends the alert_detail leg with success on rule_viewer_loaded success', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'alert_detail', placement: 'list' });
    simulateInteraction('grafana_alerting_rule_viewer_loaded', { status: 'success' });

    expect(mockHandle.end).toHaveBeenCalledWith('success', { endEvent: 'rule_viewer_loaded' });
  });

  it('ends the alert_detail leg with error on rule_viewer_loaded not_found', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'alert_detail', placement: 'list' });
    simulateInteraction('grafana_alerting_rule_viewer_loaded', { status: 'not_found' });

    expect(mockHandle.end).toHaveBeenCalledWith('error', { endEvent: 'rule_viewer_loaded', status: 'not_found' });
  });

  it('does not end the alert_detail leg when a different destination loads', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'alert_detail', placement: 'list' });
    // The rule list mounting belongs to the view_all_rules leg, not alert_detail.
    simulateInteraction('grafana_alerting_rule_list_page_view', { view: 'v2' });

    expect(mockHandle.end).not.toHaveBeenCalled();
  });

  it('ends the view_all_rules leg with success and the view attribute on rule_list_page_view', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'view_all_rules', placement: 'footer' });
    simulateInteraction('grafana_alerting_rule_list_page_view', { view: 'v2' });

    expect(mockHandle.end).toHaveBeenCalledWith('success', { endEvent: 'rule_list_page_view', view: 'v2' });
  });

  it('ends the view_all_alerts leg with error on alert_groups_loaded error', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'view_all_alerts', placement: 'footer' });
    simulateInteraction('grafana_alerting_alert_groups_loaded', { status: 'error' });

    expect(mockHandle.end).toHaveBeenCalledWith('error', { endEvent: 'alert_groups_loaded', status: 'error' });
  });

  it('ends the create_rule leg with success on rule_editor_loaded success', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'create_rule', placement: 'footer' });
    simulateInteraction('grafana_alerting_rule_editor_loaded', { status: 'success' });

    expect(mockHandle.end).toHaveBeenCalledWith('success', { endEvent: 'rule_editor_loaded' });
  });

  it('ends the create_rule leg with error on rule_editor_loaded denied', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'create_rule', placement: 'empty_state' });
    simulateInteraction('grafana_alerting_rule_editor_loaded', { status: 'denied' });

    expect(mockHandle.end).toHaveBeenCalledWith('error', { endEvent: 'rule_editor_loaded', status: 'denied' });
  });

  it('starts a fresh journey on a second qualifying click (cancelOnRestart is tracker-side)', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'alert_detail', placement: 'list' });
    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'alert_detail', placement: 'list' });

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(2);
  });
});
