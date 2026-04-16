import { type StepHandle, onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs } from './utils';

/**
 * Journey: browse_to_resource
 *
 * User browses the dashboards list and opens a resource.
 *
 * Start triggers:
 *   - grafana_browse_dashboards_page_view — user lands on the browse dashboards page (no active journey)
 *
 * Steps:
 *   - navigate_folder — user clicks a folder item; ends when the folder view loads
 *   - select_resource — user clicks a non-folder item; ends when the dashboard loads
 *
 * End conditions:
 *   - success: dashboards_init_dashboard_completed — dashboard loaded after resource click
 *   - timeout: 60s — no end condition fires
 */

registerJourneyTriggers('browse_to_resource', (tracker) => {
  let pendingFolderStep: StepHandle | null = null;
  const { add, cleanup } = collectUnsubs();

  // Folder click starts a duration step
  add(onInteraction('grafana_browse_dashboards_page_click_list_item', (props) => {
    const existing = tracker.getActiveJourney('browse_to_resource');
    if (existing && props.itemKind === 'folder') {
      pendingFolderStep = existing.addStep('navigate_folder', {
        folderUID: String(props.uid ?? ''),
      });
    }
  }));

  // Page view ends the folder step (folder loaded) or starts the journey
  add(onInteraction('grafana_browse_dashboards_page_view', (props) => {
    const folderUID = String(props.folderUID ?? '');
    const existing = tracker.getActiveJourney('browse_to_resource');

    if (existing) {
      // End the pending folder navigation step
      if (pendingFolderStep) {
        pendingFolderStep.end({ folderUID });
        pendingFolderStep = null;
      }
      existing.setAttributes({ folderUID });
    } else {
      tracker.startJourney('browse_to_resource', {
        attributes: {
          source: 'browse_dashboards',
          folderUID,
        },
      });
    }
  }));

  return cleanup;
});

onJourneyInstance('browse_to_resource', (handle) => {
  let pendingSelectStep: StepHandle | null = null;
  const { add, cleanup } = collectUnsubs();

  // User clicks a non-folder item - start a duration step until resource loads
  add(onInteraction('grafana_browse_dashboards_page_click_list_item', (props) => {
    if (handle.isActive && props.itemKind !== 'folder') {
      pendingSelectStep = handle.addStep('select_resource', {
        resourceType: String(props.itemKind ?? 'unknown'),
        resourceUID: String(props.uid ?? ''),
      });
      handle.setAttributes({
        resourceType: String(props.itemKind ?? 'unknown'),
        resourceUID: String(props.uid ?? ''),
      });
    }
  }));

  // Dashboard loads -> end the select step and the journey
  add(onInteraction('dashboards_init_dashboard_completed', (props) => {
    if (handle.isActive) {
      if (pendingSelectStep) {
        pendingSelectStep.end({
          dashboardUid: String(props.uid ?? ''),
        });
        pendingSelectStep = null;
      }
      handle.setAttributes({
        resourceType: 'dashboard',
        dashboardUid: String(props.uid ?? ''),
      });
      handle.end('success');
    }
  }));

  return cleanup;
});
