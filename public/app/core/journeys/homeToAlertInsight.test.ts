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

  it('starts the journey for each qualifying card action with coerced attributes', () => {
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

    for (const action of ['view_all_alerts', 'create_rule']) {
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

  it('does not start a journey for view_all_rules (no data-settled signal on the rule list)', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'view_all_rules', placement: 'footer' });

    expect(mockTracker.startJourney).not.toHaveBeenCalled();
  });

  it('does not start a journey for a new-tab (Cmd/Ctrl) click', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, {
      surface: 'alerts_card',
      action: 'alert_detail',
      placement: 'list',
      new_tab: true,
    });

    expect(mockTracker.startJourney).not.toHaveBeenCalled();
  });

  it('ignores an unrelated interaction', () => {
    loadWiring();

    simulateInteraction('grafana_some_other_event', { foo: 'bar' });

    expect(mockTracker.startJourney).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'alert_detail -> success',
      action: 'alert_detail',
      placement: 'list',
      event: 'grafana_alerting_rule_viewer_loaded',
      props: { status: 'success' },
      outcome: 'success',
      attributes: { endEvent: 'rule_viewer_loaded' },
    },
    {
      name: 'alert_detail -> error (not_found)',
      action: 'alert_detail',
      placement: 'list',
      event: 'grafana_alerting_rule_viewer_loaded',
      props: { status: 'not_found' },
      outcome: 'error',
      attributes: { endEvent: 'rule_viewer_loaded', status: 'not_found' },
    },
    {
      name: 'view_all_alerts -> error',
      action: 'view_all_alerts',
      placement: 'footer',
      event: 'grafana_alerting_alert_groups_loaded',
      props: { status: 'error' },
      outcome: 'error',
      attributes: { endEvent: 'alert_groups_loaded', status: 'error' },
    },
    {
      name: 'create_rule -> success',
      action: 'create_rule',
      placement: 'footer',
      event: 'grafana_alerting_rule_editor_loaded',
      props: { status: 'success' },
      outcome: 'success',
      attributes: { endEvent: 'rule_editor_loaded' },
    },
    {
      name: 'create_rule -> error (denied)',
      action: 'create_rule',
      placement: 'empty_state',
      event: 'grafana_alerting_rule_editor_loaded',
      props: { status: 'denied' },
      outcome: 'error',
      attributes: { endEvent: 'rule_editor_loaded', status: 'denied' },
    },
  ])('ends the journey: $name', ({ action, placement, event, props, outcome, attributes }) => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action, placement });
    simulateInteraction(event, props);

    expect(mockHandle.end).toHaveBeenCalledWith(outcome, attributes);
  });

  it('does not end the alert_detail leg when a different destination loads', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'alert_detail', placement: 'list' });
    // The rule-list mount event is unrelated to the alert detail journey.
    simulateInteraction('grafana_alerting_rule_list_page_view', { view: 'v2' });

    expect(mockHandle.end).not.toHaveBeenCalled();
  });

  it('starts a fresh journey on a second qualifying click (cancelOnRestart is tracker-side)', () => {
    loadWiring();

    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'alert_detail', placement: 'list' });
    simulateInteraction(CARD_CLICKED, { surface: 'alerts_card', action: 'alert_detail', placement: 'list' });

    expect(mockTracker.startJourney).toHaveBeenCalledTimes(2);
  });
});
