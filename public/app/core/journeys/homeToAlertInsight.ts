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
 *   - grafana_homepage_cta_clicked (surface alerts_card) — alert_detail, view_all_alerts, or create_rule. `action`
 *     selects the destination and end event; `msSinceLoad` carries the card-visible → click dwell.
 *   - view_all_rules is excluded until the rule list emits a data-settled signal; its page-view
 *     event fires at mount, before the lazy list and rule data load.
 *   - Cmd/Ctrl clicks carry `new_tab: true` and never start a journey because the browser opens
 *     the destination in another tab.
 *
 * End conditions (each leg ends ONLY on its own destination's load event, so bailing to a
 * different alerting page never fakes a success):
 *   - alert_detail    → grafana_alerting_rule_viewer_loaded  (success | error)
 *   - view_all_alerts → grafana_alerting_alert_groups_loaded (success | error)
 *   - create_rule     → grafana_alerting_rule_editor_loaded  (success | error[denied])
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

// One destination leg per card action; the journey subscribes only to the selected action's event.
const LEG_BY_ACTION: Record<string, Leg> = {
  alert_detail: { event: 'grafana_alerting_rule_viewer_loaded', resolve: settled('rule_viewer_loaded') },
  view_all_alerts: { event: 'grafana_alerting_alert_groups_loaded', resolve: settled('alert_groups_loaded') },
  create_rule: { event: 'grafana_alerting_rule_editor_loaded', resolve: settled('rule_editor_loaded') },
};

// Trigger->instance handoff: startJourney runs onJourneyInstance synchronously; cancelOnRestart keeps one instance.
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
    // Cmd/Ctrl-click opens a new tab (interceptLinkClicks ignores it); a journey here could only time out.
    if (props.new_tab === true) {
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
