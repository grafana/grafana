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

// The destination load event that completes each card action's leg.
const END_EVENT_BY_ACTION: Record<string, string> = {
  alert_detail: 'grafana_alerting_rule_viewer_loaded',
  view_all_alerts: 'grafana_alerting_alert_groups_loaded',
  view_all_rules: 'grafana_alerting_rule_list_page_view',
  create_rule: 'grafana_alerting_rule_editor_loaded',
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
    if (!END_EVENT_BY_ACTION[action]) {
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
  // The leg this instance is running. Only the matching destination event ends it.
  const endEvent = END_EVENT_BY_ACTION[lastAction];
  const { add, cleanup } = collectUnsubs();

  // alert_detail: rule detail view settled.
  add(
    onInteraction('grafana_alerting_rule_viewer_loaded', (props) => {
      if (endEvent !== 'grafana_alerting_rule_viewer_loaded') {
        return;
      }
      if (str(props.status) === 'success') {
        handle.end('success', { endEvent: 'rule_viewer_loaded' });
      } else {
        handle.end('error', { endEvent: 'rule_viewer_loaded', status: str(props.status) });
      }
    })
  );

  // view_all_alerts: alert groups query settled.
  add(
    onInteraction('grafana_alerting_alert_groups_loaded', (props) => {
      if (endEvent !== 'grafana_alerting_alert_groups_loaded') {
        return;
      }
      if (str(props.status) === 'success') {
        handle.end('success', { endEvent: 'alert_groups_loaded' });
      } else {
        handle.end('error', { endEvent: 'alert_groups_loaded', status: str(props.status) });
      }
    })
  );

  // create_rule: rule editor rendered (form visible or permission denied).
  add(
    onInteraction('grafana_alerting_rule_editor_loaded', (props) => {
      if (endEvent !== 'grafana_alerting_rule_editor_loaded') {
        return;
      }
      if (str(props.status) === 'success') {
        handle.end('success', { endEvent: 'rule_editor_loaded' });
      } else {
        handle.end('error', { endEvent: 'rule_editor_loaded', status: str(props.status) });
      }
    })
  );

  // view_all_rules: rule list mounted. Weak signal — fires before the list data loads.
  add(
    onInteraction('grafana_alerting_rule_list_page_view', (props) => {
      if (endEvent !== 'grafana_alerting_rule_list_page_view') {
        return;
      }
      handle.end('success', { endEvent: 'rule_list_page_view', view: str(props.view) });
    })
  );

  return cleanup;
});
