import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  type SceneComponentProps,
  SceneObjectBase,
  type SceneObject,
  type SceneObjectState,
  type SceneObjectUrlSyncHandler,
  SceneObjectUrlSyncConfig,
  sceneGraph,
  VizPanel,
} from '@grafana/scenes';
import { Drawer } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { PulseDrawerContent } from 'app/features/pulse/components/PulseDrawerContent';
import { type PanelSuggestion } from 'app/features/pulse/utils/lookups';

import { type DashboardScene } from './DashboardScene';

/**
 * Self-contained mirrors of `getDashboardSceneFor` and
 * `getPanelIdForVizPanel` from `../utils/utils.ts`. Inlined here to
 * avoid the import edge that would otherwise close a circular
 * dependency:
 *
 *   utils.ts -> DashboardScene.tsx -> DashboardSceneUrlSync.ts ->
 *   PulseDrawer.tsx -> utils.ts
 *
 * `DashboardScene` itself is imported as a type, which the
 * circular-dependency checker erases, so we keep this file at the
 * leaves of the dashboard-scene graph.
 */
function getRootDashboardScene(sceneObject: SceneObject): DashboardScene {
  // The scene root is always a DashboardScene in the contexts where
  // PulseDrawer is mounted (the dashboard `overlay` slot). The cast
  // matches the runtime invariant; the original helper threw when
  // mounted elsewhere and we'd want any such bug to be loud and
  // immediate, but in practice the scenes API guarantees this.
  return sceneObject.getRoot() as DashboardScene;
}

function panelIdFromVizPanelKey(panel: SceneObject): number {
  return parseInt(panel.state.key!.replace('panel-', ''), 10);
}

export interface PulseDrawerState extends SceneObjectState {
  /** When set, the drawer scopes its thread list to a specific panel. */
  panelId?: number;
  /** When set, the drawer opens straight to this thread. Set via the
   *  `?pulse=thread-<uid>` deep link from the global Pulse overview. */
  initialThreadUID?: string;
}

/**
 * PulseDrawer is the side-drawer overlay that hosts the Pulse UI for
 * the active dashboard. It mirrors AddLibraryPanelDrawer's pattern: a
 * SceneObject that the dashboard's `overlay` slot renders. URL state
 * is synced via a single `pulse` key whose value is "open", "panel-N",
 * or "thread-<uid>"; deep links restore both the visibility and the
 * scoped variant.
 */
export class PulseDrawer extends SceneObjectBase<PulseDrawerState> {
  protected _urlSync: SceneObjectUrlSyncHandler = new SceneObjectUrlSyncConfig(this, { keys: ['pulse'] });

  public getUrlState() {
    if (this.state.initialThreadUID !== undefined) {
      return { pulse: `thread-${this.state.initialThreadUID}` };
    }
    if (this.state.panelId !== undefined) {
      return { pulse: `panel-${this.state.panelId}` };
    }
    return { pulse: 'open' };
  }

  public updateFromUrl(values: Record<string, string | string[] | null | undefined>) {
    const v = values.pulse;
    if (typeof v !== 'string') {
      return;
    }
    if (v.startsWith('panel-')) {
      const id = parseInt(v.slice('panel-'.length), 10);
      if (!Number.isNaN(id)) {
        this.setState({ panelId: id });
      }
      return;
    }
    if (v.startsWith('thread-')) {
      const uid = v.slice('thread-'.length).trim();
      if (uid) {
        this.setState({ initialThreadUID: uid });
      }
    }
  }

  /** Called once the drawer content has selected the deep-linked thread,
   *  so the URL collapses back to `pulse=open` and a refresh doesn't
   *  re-trigger the auto-open behavior. */
  public clearInitialThreadUID = () => {
    if (this.state.initialThreadUID !== undefined) {
      this.setState({ initialThreadUID: undefined });
    }
  };

  public onClose = () => {
    getRootDashboardScene(this).closeModal();
  };

  static Component = ({ model }: SceneComponentProps<PulseDrawer>) => {
    const dashboard = getRootDashboardScene(model);
    const { panelId, initialThreadUID } = model.useState();
    const resourceUID = dashboard.state.uid ?? '';
    const panels = collectPanels(dashboard);
    const currentUserId = contextSrv.user.id;
    // Reopen-thread is admin-only; close+delete-thread also surface for
    // org admins so a moderation flow exists even when the original
    // author has rotated out.
    const isAdmin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;

    const title =
      panelId !== undefined
        ? t('pulse.drawer.title-panel', 'Pulse · panel #{{id}}', { id: panelId })
        : t('pulse.drawer.title', 'Pulse');

    return (
      <Drawer title={title} subtitle={dashboard.state.title} onClose={model.onClose} size="md">
        <PulseDrawerContent
          resourceUID={resourceUID}
          panelId={panelId}
          panels={panels}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          initialThreadUID={initialThreadUID}
          onInitialThreadOpened={model.clearInitialThreadUID}
          onMentionPanel={(id) => {
            // Navigate to the mentioned panel by switching the drawer to
            // its panel-scoped variant. The dashboard already provides
            // the underlying viewPanel URL key for full-screen view if
            // the user wants more focus.
            model.setState({ panelId: id });
          }}
        />
      </Drawer>
    );
  };
}

/**
 * collectPanels walks the scene tree and returns a flat list of viz
 * panels with their numeric ids and titles, used by the composer's
 * `#panel` mention picker. The list is computed lazily on each render
 * so newly added panels show up without explicit invalidation; this is
 * cheap because the scene tree is already in memory.
 */
function collectPanels(dashboard: DashboardScene): PanelSuggestion[] {
  if (!dashboard.state.body) {
    return [];
  }
  const objects = sceneGraph.findAllObjects(dashboard, (obj) => obj instanceof VizPanel);
  const out: PanelSuggestion[] = [];
  for (const obj of objects) {
    if (!(obj instanceof VizPanel)) {
      continue;
    }
    const id = panelIdFromVizPanelKey(obj);
    if (id === undefined || id === null || Number.isNaN(id)) {
      continue;
    }
    out.push({ id, title: obj.state.title || `Panel ${id}` });
  }
  return out;
}

/** isPulseEnabled gates everything Pulse-related on the feature toggle. */
export function isPulseEnabled(): boolean {
  return Boolean(config.featureToggles.dashboardPulse);
}
