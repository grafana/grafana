import { useCallback, useMemo } from 'react';

import { dateTime, rangeUtil } from '@grafana/data';
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
import { type CurrentTimeRange, type ResourceMentionSource } from 'app/features/pulse/components/PulseComposer';
import { PulseDrawerContent } from 'app/features/pulse/components/PulseDrawerContent';
import { useFolderDashboards } from 'app/features/pulse/hooks/useFolderDashboards';
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
 * leaves of the dashboard-scene graph. That also means we can't use
 * `instanceof DashboardScene` here — we'd have to value-import the
 * class and that re-closes the cycle — so we lean on a constructor
 * name check as the type guard.
 */
function isDashboardSceneRoot(obj: SceneObject): obj is DashboardScene {
  return obj.constructor.name === 'DashboardScene';
}

function getRootDashboardScene(sceneObject: SceneObject): DashboardScene {
  const root = sceneObject.getRoot();
  if (!isDashboardSceneRoot(root)) {
    throw new Error('PulseDrawer mounted outside a DashboardScene');
  }
  return root;
}

function panelIdFromVizPanelKey(panel: SceneObject): number {
  return parseInt(panel.state.key!.replace('panel-', ''), 10);
}

export interface PulseDrawerState extends SceneObjectState {
  /**
   * Active "Panel" filter. When set, the drawer narrows the list to
   * threads anchored to this panel OR mentioning it via a `#panel`
   * chip on any pulse (root or reply). URL-synced via `pulsePanel=N`.
   */
  panelFilter?: number;
  /**
   * Active "Users" filter. When set, the drawer narrows the list to
   * threads the user started or replied on. URL-synced via
   * `pulseUser=N`.
   */
  authorFilter?: number;
  /**
   * Free-form text filter. Backend matches the thread title OR the
   * body_text of any non-deleted pulse on the thread, so a hit in a
   * reply still surfaces its parent. URL-synced via `pulseQ=...`.
   */
  searchFilter?: string;
  /** When set, the drawer opens straight to this thread. Set via the
   *  `?pulse=thread-<uid>` deep link from the global Pulse overview. */
  initialThreadUID?: string;
}

/**
 * PulseDrawer is the side-drawer overlay that hosts the Pulse UI for
 * the active dashboard. It mirrors AddLibraryPanelDrawer's pattern: a
 * SceneObject that the dashboard's `overlay` slot renders.
 *
 * URL contract:
 *   `?pulse=open` ............... drawer visible, no filters
 *   `?pulse=open&pulsePanel=5` .. narrowed to panel 5
 *   `?pulse=open&pulseUser=7` ... narrowed to user 7
 *   `?pulse=open&pulseQ=foo` .... narrowed to threads matching "foo"
 *   `?pulse=thread-<uid>` ....... opened straight to <uid>
 *   (legacy) `?pulse=panel-5` ... back-compat — read as pulsePanel=5
 *
 * All three filters can combine. They're separate URL keys (rather
 * than stuffed into the `pulse` key) so a user can copy a filtered
 * link and the dropdowns can reset one filter without rewriting the
 * `pulse` value the drawer-open state lives on.
 */
export class PulseDrawer extends SceneObjectBase<PulseDrawerState> {
  protected _urlSync: SceneObjectUrlSyncHandler = new SceneObjectUrlSyncConfig(this, {
    keys: ['pulse', 'pulsePanel', 'pulseUser', 'pulseQ'],
  });

  public getUrlState() {
    if (this.state.initialThreadUID !== undefined) {
      return {
        pulse: `thread-${this.state.initialThreadUID}`,
        pulsePanel: undefined,
        pulseUser: undefined,
        pulseQ: undefined,
      };
    }
    return {
      pulse: 'open',
      pulsePanel: this.state.panelFilter !== undefined ? String(this.state.panelFilter) : undefined,
      pulseUser: this.state.authorFilter !== undefined ? String(this.state.authorFilter) : undefined,
      // We omit empty/whitespace search filters from the URL so a
      // user typing-and-clearing doesn't litter history with empty
      // pulseQ entries. Same trim contract is enforced in the
      // listThreads RTK query.
      pulseQ:
        this.state.searchFilter !== undefined && this.state.searchFilter.trim() !== ''
          ? this.state.searchFilter
          : undefined,
    };
  }

  public updateFromUrl(values: Record<string, string | string[] | null | undefined>) {
    const v = values.pulse;
    if (typeof v === 'string') {
      if (v.startsWith('panel-')) {
        // Back-compat: an old `?pulse=panel-N` link still lands on the
        // panel-filtered drawer. We translate it to the new shape so
        // subsequent navigation produces the new URL form.
        const id = parseInt(v.slice('panel-'.length), 10);
        if (!Number.isNaN(id)) {
          this.setState({ panelFilter: id });
        }
      } else if (v.startsWith('thread-')) {
        const uid = v.slice('thread-'.length).trim();
        if (uid) {
          this.setState({ initialThreadUID: uid });
        }
      }
    }

    if (typeof values.pulsePanel === 'string' && values.pulsePanel !== '') {
      const id = parseInt(values.pulsePanel, 10);
      if (!Number.isNaN(id)) {
        this.setState({ panelFilter: id });
      }
    } else if (values.pulsePanel === null || values.pulsePanel === '') {
      this.setState({ panelFilter: undefined });
    }

    if (typeof values.pulseUser === 'string' && values.pulseUser !== '') {
      const id = parseInt(values.pulseUser, 10);
      if (!Number.isNaN(id)) {
        this.setState({ authorFilter: id });
      }
    } else if (values.pulseUser === null || values.pulseUser === '') {
      this.setState({ authorFilter: undefined });
    }

    if (typeof values.pulseQ === 'string' && values.pulseQ !== '') {
      this.setState({ searchFilter: values.pulseQ });
    } else if (values.pulseQ === null || values.pulseQ === '') {
      this.setState({ searchFilter: undefined });
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

  public setPanelFilter = (panelId: number | undefined) => {
    this.setState({ panelFilter: panelId });
  };

  public setAuthorFilter = (userId: number | undefined) => {
    this.setState({ authorFilter: userId });
  };

  public setSearchFilter = (query: string | undefined) => {
    // Normalize empty / whitespace-only to undefined so getUrlState
    // produces a clean URL and downstream "any filter active?"
    // checks need only one branch.
    const normalized = query?.trim() ? query : undefined;
    if (normalized !== this.state.searchFilter) {
      this.setState({ searchFilter: normalized });
    }
  };

  public clearFilters = () => {
    this.setState({ panelFilter: undefined, authorFilter: undefined, searchFilter: undefined });
  };

  public onClose = () => {
    getRootDashboardScene(this).closeModal();
  };

  static Component = PulseDrawerRenderer;
}

/**
 * PulseDrawerRenderer is the React function component that backs
 * `PulseDrawer.Component`. We lift it out of the class body so React
 * Hooks (`useFolderDashboards`, `useMemo`) don't trip the
 * rules-of-hooks lint check, which only recognizes top-level
 * functions and named components as valid hook call sites.
 */
function PulseDrawerRenderer({ model }: SceneComponentProps<PulseDrawer>) {
  const dashboard = getRootDashboardScene(model);
  const { panelFilter, authorFilter, searchFilter, initialThreadUID } = model.useState();
  const resourceUID = dashboard.state.uid ?? '';
  const panels = collectPanels(dashboard);
  const currentUserId = contextSrv.user.id;
  // Reopen-thread is admin-only; close+delete-thread also surface for
  // org admins so a moderation flow exists even when the original
  // author has rotated out.
  const isAdmin = contextSrv.hasRole('Admin') || contextSrv.isGrafanaAdmin;

  // Sibling-dashboards mention source: the parent folder's direct
  // child dashboards (minus the current one — referencing the
  // dashboard you're already on inside its own thread would be
  // gratuitous noise). Dashboards parented to the root folder fall
  // back to an empty list rather than the org-wide set; the picker
  // there would be unbounded and dominated by unrelated noise.
  const folderUID = dashboard.state.meta.folderUid;
  // Loading is gated on the drawer being open AND the dashboard
  // having a parent folder; the hook itself returns an empty list
  // for undefined folderUID, but skipping the fetch entirely also
  // skips an avoidable searcher round-trip per dashboard view.
  const folderDashboards = useFolderDashboards(folderUID, Boolean(folderUID));

  // Dashboard's live time range, fed to the composer so `@now` /
  // `@time` insertions freeze the current window into a chip. The
  // `value` from SceneTimeRange.useState() resolves any relative
  // bounds (e.g. "now-1h") into absolute DateTimes, so .from / .to
  // are always epoch-ms friendly. The label uses describeTimeRange
  // on the raw range so "Last 1 hour" stays readable while the
  // chip's frozen ms range stays exact.
  const sceneTimeRange = sceneGraph.getTimeRange(dashboard);
  const timeRangeState = sceneTimeRange.useState();
  const currentTimeRange = useMemo<CurrentTimeRange>(() => {
    const value = timeRangeState.value;
    return {
      from: value.from.valueOf(),
      to: value.to.valueOf(),
      label: rangeUtil.describeTimeRange(value.raw, timeRangeState.timeZone),
    };
  }, [timeRangeState.value, timeRangeState.timeZone]);

  // Clicking a time chip inside the drawer must feel like dragging
  // the date picker — update SceneTimeRange in place so panels
  // re-query without a page navigation. The chip's anchor stays a
  // real href so cmd/ctrl-click still opens a new tab (the renderer
  // skips preventDefault when a modifier key is held).
  const onTimeChipClick = useCallback(
    (from: number, to: number) => {
      sceneTimeRange.setState({
        from: dateTime(from).toISOString(),
        to: dateTime(to).toISOString(),
      });
    },
    [sceneTimeRange]
  );

  const resourceMentions = useMemo<ResourceMentionSource[]>(() => {
    const siblings = folderDashboards.items.filter((d) => d.uid !== resourceUID);
    if (siblings.length === 0) {
      // Empty source list collapses the `#dashboard` mention path
      // gracefully — the composer only renders kinds it can offer
      // results for, so the footer hint and picker stay panel-only.
      return [];
    }
    return [{ kind: 'dashboard', suggestions: siblings }];
  }, [folderDashboards.items, resourceUID]);

  return (
    <Drawer title={t('pulse.drawer.title', 'Pulse')} subtitle={dashboard.state.title} onClose={model.onClose} size="md">
      <PulseDrawerContent
        resourceUID={resourceUID}
        panelFilter={panelFilter}
        authorFilter={authorFilter}
        searchFilter={searchFilter}
        panels={panels}
        resourceMentions={resourceMentions}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        currentTimeRange={currentTimeRange}
        onTimeChipClick={onTimeChipClick}
        initialThreadUID={initialThreadUID}
        onInitialThreadOpened={model.clearInitialThreadUID}
        onPanelFilterChange={model.setPanelFilter}
        onAuthorFilterChange={model.setAuthorFilter}
        onSearchFilterChange={model.setSearchFilter}
        onClearFilters={model.clearFilters}
        onMentionPanel={(id) => {
          // Click on a `#panel` chip inside a thread applies the
          // panel filter. Same affordance as clicking the title-bar
          // mention icon: stay in the drawer, narrow the list.
          model.setState({ panelFilter: id });
        }}
      />
    </Drawer>
  );
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
