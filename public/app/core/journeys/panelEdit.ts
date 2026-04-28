import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs, str } from './utils';

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
          panelId: str(props.id),
          source: str(props.source),
          'grafana.panel.type': str(props.panelType),
        },
      });
    }
  });
});

onJourneyInstance('panel_edit', (handle) => {
  const { add, cleanup } = collectUnsubs();

  // Track panel edit interactions as pointwise events (no duration).
  // recordEvent is the fire-and-forget form - no StepHandle to leak.
  add(
    onInteraction('grafana_panel_edit_next_interaction', (props) => {
      const action = str(props.action ?? 'unknown');

      switch (action) {
        case 'add_query':
          handle.recordEvent('add_query', {
            source: str(props.source),
            card_source: str(props.card_source),
          });
          break;
        case 'add_transformation_initiated':
          handle.recordEvent('add_transformation', {
            source: str(props.source),
          });
          break;
        case 'change_sidebar_view':
          handle.recordEvent('change_view', {
            view: str(props.view),
          });
          break;
        default:
          handle.recordEvent(action);
          break;
      }
    })
  );

  // Discard fires before close - mark the outcome
  let discarded = false;
  add(
    onInteraction('panel_edit_discarded', () => {
      discarded = true;
    })
  );

  // End journey when panel edit mode closes
  add(
    onInteraction('panel_edit_closed', () => {
      handle.end(discarded ? 'discarded' : 'success');
    })
  );

  return cleanup;
});
