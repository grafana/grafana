import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs, str } from './utils';

/**
 * Journey: search_to_resource
 *
 * User searches via command palette and navigates to a resource.
 *
 * Start triggers:
 *   - command_palette_opened — user opens the command palette
 *
 * Events (point-in-time):
 *   - search_query — user typed in the palette (debounced at the source, one per burst).
 *     Carries `hasQuery` and bucketed `queryLength`; never the raw query string.
 *
 * Mid-journey:
 *   - command_palette_action_selected sets `resourceType`, `actionId`, `actionName`,
 *     and `interactionMode` (`keyboard` | `mouse` | `unknown`) so we can see how
 *     the user activated the result.
 *
 * End conditions:
 *   - success: dashboards_init_dashboard_completed — dashboard loaded after palette action
 *   - success: grafana_browse_dashboards_page_view — folder browse page loaded after folder selection
 *   - success: command_palette_closed — palette closed after a non-dashboard/folder action was selected
 *   - discarded: command_palette_closed — palette closed without any action selected
 *   - timeout: 60s — no end condition fires
 */

registerJourneyTriggers('search_to_resource', (tracker) => {
  return onInteraction('command_palette_opened', () => {
    tracker.startJourney('search_to_resource', {
      attributes: { source: 'command_palette' },
    });
  });
});

onJourneyInstance('search_to_resource', (handle) => {
  let actionSelected = false;
  let selectedResourceType = '';
  const { add, cleanup } = collectUnsubs();

  // Track whether user selected something, enrich with resource type
  add(
    onInteraction('command_palette_action_selected', (props) => {
      actionSelected = true;
      const actionId = str(props.actionId);
      if (actionId.startsWith('go/dashboard')) {
        selectedResourceType = 'dashboard';
      } else if (actionId.startsWith('go/folder')) {
        selectedResourceType = 'folder';
      } else {
        selectedResourceType = 'other';
      }
      handle.setAttributes({
        resourceType: selectedResourceType,
        actionId,
        actionName: str(props.actionName),
        interactionMode: str(props.interactionMode ?? 'unknown'),
      });
    })
  );

  // Each debounced typing burst becomes a point-in-time event on the journey.
  add(
    onInteraction('command_palette_search_query', (props) => {
      handle.recordEvent('search_query', {
        hasQuery: str(props.hasQuery ?? 'false'),
        queryLength: str(props.queryLength ?? 'empty'),
      });
    })
  );

  // Dashboard loaded -> success
  add(
    onInteraction('dashboards_init_dashboard_completed', (props) => {
      handle.setAttributes({
        resourceType: 'dashboard',
        dashboardUid: str(props.uid),
      });
      handle.end('success');
    })
  );

  // Browse page loaded after folder selection -> success
  add(
    onInteraction('grafana_browse_dashboards_page_view', (props) => {
      if (selectedResourceType === 'folder') {
        handle.setAttributes({
          folderUID: str(props.folderUID),
        });
        handle.end('success');
      }
    })
  );

  // Command palette closed:
  // - no action selected -> discarded
  // - nav action selected (resourceType 'other') -> success (palette closing IS the navigation)
  add(
    onInteraction('command_palette_closed', () => {
      if (!actionSelected) {
        handle.end('discarded');
      } else if (selectedResourceType === 'other') {
        handle.end('success');
      }
      // dashboard/folder: don't end here, wait for their specific load events
    })
  );

  return cleanup;
});
