import {
  locationService,
  onInteraction,
  onJourneyInstance,
  registerJourneyTriggers,
  type StepHandle,
} from '@grafana/runtime';

import { collectUnsubs, str } from './utils';

// Path prefixes the journey treats as still in-scope. Anything else is treated
// as the user leaving the browse area and the journey ends as `abandoned`.
const IN_SCOPE_PREFIXES = ['/dashboards', '/dashboard/', '/d/'];

function pathInScope(pathname: string): boolean {
  if (pathname === '/dashboards') {
    return true;
  }
  return IN_SCOPE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

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
 *   - create_folder — user opens the new-folder drawer; ends when the folder is created
 *     (carries `isSubfolder`, `folderDepth`). The journey continues; the post-create
 *     page_view re-fires and enriches `folderUID`. If the user dismisses the drawer
 *     without creating, the framework backstop closes the step as `unended` at journey end.
 *
 * End conditions:
 *   - success: dashboards_init_dashboard_completed — dashboard loaded after resource click
 *   - abandoned: SPA route change to a path outside `/dashboards`, `/dashboard/`, `/d/`
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
  let pendingCreateFolderStep: StepHandle | null = null;
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

  // Drawer open -> create_folder step starts. Captures the user's intent and the
  // time spent filling the form (not just the API latency).
  add(
    onInteraction('grafana_browse_dashboards_new_folder_drawer_opened', () => {
      if (pendingCreateFolderStep) {
        pendingCreateFolderStep.end({ outcome: 'superseded' });
      }
      pendingCreateFolderStep = handle.startStep('create_folder');
    })
  );

  // Folder created -> step ends with the source attributes. Journey continues; the
  // post-create page_view above will fire and update folderUID.
  add(
    onInteraction('grafana_manage_dashboards_folder_created', (props) => {
      if (pendingCreateFolderStep) {
        pendingCreateFolderStep.end({
          outcome: 'success',
          isSubfolder: str(props.is_subfolder),
          folderDepth: str(props.folder_depth),
        });
        pendingCreateFolderStep = null;
      }
    })
  );

  // SPA route change: if the user navigates outside the browse / dashboard area
  // (e.g., to /explore, /connections), end the journey as `abandoned`. The framework's
  // beforeunload + visibility-change handlers only catch tab-level signals; in-app
  // navigation needs explicit handling.
  let initialLocation = true;
  const sub = locationService.getLocationObservable().subscribe((location) => {
    if (initialLocation) {
      // BehaviorSubject fires with current location on subscribe; ignore that.
      initialLocation = false;
      return;
    }
    if (!pathInScope(location.pathname) && handle.isActive) {
      handle.end('abandoned', { abandonedAt: location.pathname });
    }
  });
  add(() => sub.unsubscribe());

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
