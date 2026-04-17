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
  // Only wires the start condition. All duration-step bookkeeping lives in
  // onJourneyInstance so each journey instance has its own closure (no module-scope
  // StepHandle that can outlive its journey).
  return onInteraction('grafana_browse_dashboards_page_view', (props) => {
    if (!tracker.getActiveJourney('browse_to_resource')) {
      tracker.startJourney('browse_to_resource', {
        attributes: {
          source: 'browse_dashboards',
          folderUID: String(props.folderUID ?? ''),
        },
      });
    }
  });
});

onJourneyInstance('browse_to_resource', (handle) => {
  let pendingFolderStep: StepHandle | null = null;
  let pendingSelectStep: StepHandle | null = null;
  const { add, cleanup } = collectUnsubs();

  // Folder click starts a navigate_folder duration step; non-folder click starts select_resource.
  add(onInteraction('grafana_browse_dashboards_page_click_list_item', (props) => {
    if (!handle.isActive) {
      return;
    }
    if (props.itemKind === 'folder') {
      pendingFolderStep = handle.startStep('navigate_folder', {
        folderUID: String(props.uid ?? ''),
      });
    } else {
      pendingSelectStep = handle.startStep('select_resource', {
        resourceType: String(props.itemKind ?? 'unknown'),
        resourceUID: String(props.uid ?? ''),
      });
      handle.setAttributes({
        resourceType: String(props.itemKind ?? 'unknown'),
        resourceUID: String(props.uid ?? ''),
      });
    }
  }));

  // Subsequent page_views end the pending folder step and enrich the journey.
  add(onInteraction('grafana_browse_dashboards_page_view', (props) => {
    if (!handle.isActive) {
      return;
    }
    const folderUID = String(props.folderUID ?? '');
    if (pendingFolderStep) {
      pendingFolderStep.end({ folderUID });
      pendingFolderStep = null;
    }
    handle.setAttributes({ folderUID });
  }));

  // Dashboard loads -> end the select step and the journey.
  add(onInteraction('dashboards_init_dashboard_completed', (props) => {
    if (!handle.isActive) {
      return;
    }
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
  }));

  return cleanup;
});
