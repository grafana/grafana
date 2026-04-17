import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs } from './utils';

/**
 * Journey: explore_to_dashboard
 *
 * User adds a panel from Explore to a dashboard via the "Add to dashboard" form.
 *
 * Start triggers:
 *   - e_2_d_open — user opens the "Add to dashboard" modal in Explore
 *
 * Steps:
 *   - submit — user submits the form (e_2_d_submit); carries saveTarget and newTab attributes
 *
 * End conditions:
 *   - success: explore_to_dashboard_panel_applied — panel applied to the target dashboard
 *   - discarded: e_2_d_discarded — form closed without submitting
 *   - timeout: 60s — no end condition fires (includes the new-tab case where the panel is
 *       applied in a different browser tab and cross-tab correlation is not yet supported)
 *
 * Silent interactions added by this journey:
 *   - explore_to_dashboard_panel_applied — emitted in addPanelsOnLoadBehavior.ts when the panel is applied
 */

registerJourneyTriggers('explore_to_dashboard', (tracker) => {
  return onInteraction('e_2_d_open', () => {
    tracker.startJourney('explore_to_dashboard', {
      attributes: {
        source: 'explore',
      },
    });
  });
});

onJourneyInstance('explore_to_dashboard', (handle) => {
  const { add, cleanup } = collectUnsubs();

  // Step: form submitted
  add(onInteraction('e_2_d_submit', (props) => {
    if (handle.isActive) {
      handle.recordEvent('submit', {
        saveTarget: String(props.saveTarget ?? ''),
        newTab: String(props.newTab ?? ''),
      });
      handle.setAttributes({
        saveTarget: String(props.saveTarget ?? ''),
        newTab: String(props.newTab ?? ''),
      });
    }
  }));

  // Success: panel applied on the dashboard side
  add(onInteraction('explore_to_dashboard_panel_applied', () => {
    if (handle.isActive) {
      handle.end('success');
    }
  }));

  // Discarded: form closed without submitting
  add(onInteraction('e_2_d_discarded', () => {
    if (handle.isActive) {
      handle.end('discarded');
    }
  }));

  return cleanup;
});
