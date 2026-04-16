import { onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs } from './utils';

/**
 * Journey: search_to_resource
 *
 * User searches via command palette and navigates to a resource.
 *
 * Start triggers:
 *   - command_palette_opened — user opens the command palette
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
  add(onInteraction('command_palette_action_selected', (props) => {
    actionSelected = true;
    const actionId = String(props.actionId ?? '');
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
      actionName: String(props.actionName ?? ''),
    });
  }));

  // Dashboard loaded -> success
  add(onInteraction('dashboards_init_dashboard_completed', (props) => {
    if (handle.isActive) {
      handle.setAttributes({
        resourceType: 'dashboard',
        dashboardUid: String(props.uid ?? ''),
      });
      handle.end('success');
    }
  }));

  // Browse page loaded after folder selection -> success
  add(onInteraction('grafana_browse_dashboards_page_view', (props) => {
    if (handle.isActive && selectedResourceType === 'folder') {
      handle.setAttributes({
        folderUID: String(props.folderUID ?? ''),
      });
      handle.end('success');
    }
  }));

  // Command palette closed:
  // - no action selected -> discarded
  // - nav action selected (resourceType 'other') -> success (palette closing IS the navigation)
  add(onInteraction('command_palette_closed', () => {
    if (handle.isActive) {
      if (!actionSelected) {
        handle.end('discarded');
      } else if (selectedResourceType === 'other') {
        handle.end('success');
      }
      // dashboard/folder: don't end here, wait for their specific load events
    }
  }));

  return cleanup;
});
