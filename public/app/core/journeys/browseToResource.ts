import { type StepHandle, onInteraction, registerJourneyTriggers, onJourneyInstance } from '@grafana/runtime';

import { collectUnsubs, str } from './utils';

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
 * Events (point-in-time):
 *   - folder_created — user created a folder mid-browse (the journey continues; the
 *     post-create redirect fires a new page_view that enriches `folderUID` on the journey).
 *     Carries `isSubfolder` and `folderDepth`.
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
          folderUID: str(props.folderUID),
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
  // Each new click closes any still-open prior step so we don't orphan pending handles
  // (otherwise the framework backstop closes them as `unended` at journey end, with the
  // wall-clock time until journey end rather than until the user's next click).
  add(
    onInteraction('grafana_browse_dashboards_page_click_list_item', (props) => {
      if (pendingFolderStep) {
        pendingFolderStep.end({ outcome: 'superseded' });
        pendingFolderStep = null;
      }
      if (pendingSelectStep) {
        pendingSelectStep.end({ outcome: 'superseded' });
        pendingSelectStep = null;
      }

      if (props.itemKind === 'folder') {
        pendingFolderStep = handle.startStep('navigate_folder', {
          folderUID: str(props.uid),
        });
      } else {
        pendingSelectStep = handle.startStep('select_resource', {
          resourceType: str(props.itemKind ?? 'unknown'),
          resourceUID: str(props.uid),
        });
        handle.setAttributes({
          resourceType: str(props.itemKind ?? 'unknown'),
          resourceUID: str(props.uid),
        });
      }
    })
  );

  // Subsequent page_views end the pending folder step and enrich the journey.
  add(
    onInteraction('grafana_browse_dashboards_page_view', (props) => {
      const folderUID = str(props.folderUID);
      if (pendingFolderStep) {
        pendingFolderStep.end({ folderUID });
        pendingFolderStep = null;
      }
      handle.setAttributes({ folderUID });
    })
  );

  // Folder created mid-browse — the journey continues; the post-create page_view
  // re-fires above and updates the active folderUID attribute.
  add(
    onInteraction('grafana_manage_dashboards_folder_created', (props) => {
      handle.recordEvent('folder_created', {
        isSubfolder: str(props.is_subfolder),
        folderDepth: str(props.folder_depth),
      });
    })
  );

  // Dashboard loads -> end the select step and the journey.
  add(
    onInteraction('dashboards_init_dashboard_completed', (props) => {
      if (pendingSelectStep) {
        pendingSelectStep.end({
          dashboardUid: str(props.uid),
        });
        pendingSelectStep = null;
      }
      handle.setAttributes({
        resourceType: 'dashboard',
        dashboardUid: str(props.uid),
      });
      handle.end('success');
    })
  );

  return cleanup;
});
