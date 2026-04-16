import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs } from './utils';

/**
 * Journey: dashboard_edit
 *
 * User enters edit mode on a dashboard and saves or discards changes.
 *
 * Start triggers:
 *   - dashboards_edit_button_clicked — user clicks the Edit button on a dashboard
 *
 * End conditions:
 *   - success: grafana_dashboard_saved — dashboard saved (update of existing)
 *   - success: grafana_dashboard_created — dashboard saved (new dashboard created)
 *   - discarded: dashboards_edit_discarded — user discards all changes and exits edit mode
 *   - timeout: 30 min — no end condition fires
 */

registerJourneyTriggers('dashboard_edit', (tracker) => {
  return onInteraction('dashboards_edit_button_clicked', (props) => {
    tracker.startJourney('dashboard_edit', {
      attributes: {
        dashboardUID: String(props.dashboardUid ?? ''),
      },
    });
  });
});

onJourneyInstance('dashboard_edit', (handle) => {
  const { add, cleanup } = collectUnsubs();

  add(onInteraction('grafana_dashboard_saved', () => {
    if (handle.isActive) {
      handle.end('success');
    }
  }));

  add(onInteraction('grafana_dashboard_created', () => {
    if (handle.isActive) {
      handle.end('success');
    }
  }));

  add(onInteraction('dashboards_edit_discarded', () => {
    if (handle.isActive) {
      handle.end('discarded');
    }
  }));

  return cleanup;
});
