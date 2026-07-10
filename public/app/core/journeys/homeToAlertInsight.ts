import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs, str } from './utils';

/**
 * Journey: home_to_alert_insight
 *
 * User clicks a control on the homepage "Firing alerts" card and reaches the destination
 * value moment for that control. Measures time-to-value (MTTV) from the homepage widget to
 * the alerting page the user asked for.
 *
 * Start triggers:
 *   - grafana_homepage_cta_clicked (surface alerts_card) — one of four card actions. `action`
 *     selects the destination and therefore which end event completes the journey; `msSinceLoad`
 *     carries the card-visible → click dwell so the click event's own timing is queryable on the journey.
 *
 * End conditions (each leg ends ONLY on its own destination's load event, so bailing to a
 * different alerting page never fakes a success):
 *   - alert_detail    → grafana_alerting_rule_viewer_loaded  (success | error)
 *   - view_all_alerts → grafana_alerting_alert_groups_loaded (success | error)
 *   - create_rule     → grafana_alerting_rule_editor_loaded  (success | error[denied])
 *   - view_all_rules  → grafana_alerting_rule_list_page_view (success). Weak leg: this event
 *     fires at mount, before the rule list data loads — it is the only signal the rule list
 *     emits today, so the leg over-reports "fast".
 *   - timeout: 60s — covers mid-navigation abandonment. There is no discard condition: nothing
 *     emits a "navigated elsewhere" interaction, so an abandoned journey ends via timeout.
 *
 * cancelOnRestart (registry default true): a second qualifying click cancels the in-flight
 * journey and starts a fresh one — correct MTTV semantics for a retried click.
 */

type LegResolver = (props: Record<string, unknown>) => {
  outcome: 'success' | 'error';
  attributes: Record<string, string>;
};

type Leg = {
  /** Destination interaction that ends this leg. */
  event: string;
  /** Maps the destination's props to the journey outcome and span attributes. */
  resolve: LegResolver;
};

// The three legs whose destination reports a `status`: success ends the journey, anything else errors.
function settled(endEvent: string): LegResolver {
  return (props) => {
    const status = str(props.status);
    const attributes: Record<string, string> = status === 'success' ? { endEvent } : { endEvent, status };
    return { outcome: status === 'success' ? 'success' : 'error', attributes };
  };
}

// One destination leg per card action. The journey subscribes only to the selected action's event,
// so bailing to a different alerting page never ends it.
const LEG_BY_ACTION: Record<string, Leg> = {
  alert_detail: { event: 'grafana_alerting_rule_viewer_loaded', resolve: settled('rule_viewer_loaded') },
  view_all_alerts: { event: 'grafana_alerting_alert_groups_loaded', resolve: settled('alert_groups_loaded') },
  create_rule: { event: 'grafana_alerting_rule_editor_loaded', resolve: settled('rule_editor_loaded') },
  // Weak leg: rule_list_page_view fires at mount, before the list data loads.
  view_all_rules: {
    event: 'grafana_alerting_rule_list_page_view',
    resolve: (props) => ({
      outcome: 'success',
      attributes: { endEvent: 'rule_list_page_view', view: str(props.view) },
    }),
  },
};

// Start-context handoff from the trigger to the instance closure. The trigger sets this and
// then calls startJourney, which synchronously invokes onJourneyInstance before returning — and
// cancelOnRestart guarantees a single active instance — so the instance always reads the action
// that started it. It is a plain string, not a StepHandle, so it does not leak journey state.
let lastAction = '';

registerJourneyTriggers('home_to_alert_insight', (tracker) => {
  return onInteraction('grafana_homepage_cta_clicked', (props) => {
    if (props.surface !== 'alerts_card') {
      return;
    }
    const action = String(props.action);
    if (!LEG_BY_ACTION[action]) {
      return;
    }
    lastAction = action;
    tracker.startJourney('home_to_alert_insight', {
      attributes: {
        action: str(props.action),
        placement: str(props.placement),
        severity: str(props.severity),
        msSinceLoad: str(props.ms_since_load),
      },
    });
  });
});

onJourneyInstance('home_to_alert_insight', (handle) => {
  // The trigger only starts the journey for actions in LEG_BY_ACTION, so `leg` is always set.
  const leg = LEG_BY_ACTION[lastAction];
  const { add, cleanup } = collectUnsubs();

  if (leg) {
    add(
      onInteraction(leg.event, (props) => {
        const { outcome, attributes } = leg.resolve(props);
        handle.end(outcome, attributes);
      })
    );
  }

  return cleanup;
});
