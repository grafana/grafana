import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs } from './utils';

/**
 * Journey: panel_edit
 *
 * User opens a panel in edit mode and configures queries, transformations, or visualization.
 *
 * Start triggers:
 *   - dashboards_panel_action_clicked — user clicks "edit" or "configure" on a panel's action menu
 *
 * Steps:
 *   - add_query — user adds a query (via grafana_panel_edit_next_interaction action=add_query)
 *   - add_transformation — user initiates adding a transformation (action=add_transformation_initiated)
 *   - change_view — user switches the sidebar tab (action=change_sidebar_view)
 *   - <action> — any other grafana_panel_edit_next_interaction action recorded as a step by name
 *
 * End conditions:
 *   - success: panel_edit_closed — panel editor deactivates without a prior discard
 *   - discarded: panel_edit_closed — panel editor deactivates after panel_edit_discarded fired
 *   - timeout: 30 min — no end condition fires
 *
 * Silent interactions added by this journey:
 *   - panel_edit_closed — emitted in PanelEditor.tsx when the editor scene deactivates
 *   - panel_edit_discarded — emitted in PanelEditor.tsx when the user clicks Discard
 */

registerJourneyTriggers('panel_edit', (tracker) => {
  return onInteraction('dashboards_panel_action_clicked', (props) => {
    if (props.item === 'edit' || props.item === 'configure') {
      tracker.startJourney('panel_edit', {
        attributes: {
          panelId: String(props.id ?? ''),
          source: String(props.source ?? ''),
        },
      });
    }
  });
});

onJourneyInstance('panel_edit', (handle) => {
  const { add, cleanup } = collectUnsubs();

  // Track panel edit interactions as journey steps (fire-and-forget, no duration)
  add(onInteraction('grafana_panel_edit_next_interaction', (props) => {
    if (!handle.isActive) {
      return;
    }

    const action = String(props.action ?? 'unknown');

    switch (action) {
      case 'add_query':
        handle.recordEvent('add_query', {
          source: String(props.source ?? ''),
          card_source: String(props.card_source ?? ''),
        });
        break;
      case 'add_transformation_initiated':
        handle.recordEvent('add_transformation', {
          source: String(props.source ?? ''),
        });
        break;
      case 'change_sidebar_view':
        handle.recordEvent('change_view', {
          view: String(props.view ?? ''),
        });
        break;
      default:
        handle.recordEvent(action);
        break;
    }
  }));

  // Discard fires before close - mark the outcome
  let discarded = false;
  add(onInteraction('panel_edit_discarded', () => {
    discarded = true;
  }));

  // End journey when panel edit mode closes
  add(onInteraction('panel_edit_closed', () => {
    if (handle.isActive) {
      handle.end(discarded ? 'discarded' : 'success');
    }
  }));

  return cleanup;
});
