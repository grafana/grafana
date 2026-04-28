import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import {
  type SceneComponentProps,
  SceneObjectBase,
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

import { getDashboardSceneFor, getPanelIdForVizPanel } from '../utils/utils';

import { type DashboardScene } from './DashboardScene';

export interface PulseDrawerState extends SceneObjectState {
  /** When set, the drawer scopes its thread list to a specific panel. */
  panelId?: number;
}

/**
 * PulseDrawer is the side-drawer overlay that hosts the Pulse UI for
 * the active dashboard. It mirrors AddLibraryPanelDrawer's pattern: a
 * SceneObject that the dashboard's `overlay` slot renders. URL state
 * is synced via a single `pulse` key whose value is "open" or "panel-N";
 * deep links restore both the visibility and the panel-scoped variant.
 */
export class PulseDrawer extends SceneObjectBase<PulseDrawerState> {
  protected _urlSync: SceneObjectUrlSyncHandler = new SceneObjectUrlSyncConfig(this, { keys: ['pulse'] });

  public getUrlState() {
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
    }
  }

  public onClose = () => {
    getDashboardSceneFor(this).closeModal();
  };

  static Component = ({ model }: SceneComponentProps<PulseDrawer>) => {
    const dashboard = getDashboardSceneFor(model);
    const { panelId } = model.useState();
    const resourceUID = dashboard.state.uid ?? '';
    const panels = collectPanels(dashboard);
    const currentUserId = contextSrv.user.id;

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
    const id = getPanelIdForVizPanel(obj);
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
