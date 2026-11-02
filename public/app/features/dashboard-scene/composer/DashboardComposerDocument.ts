import { t } from '@grafana/i18n';
import {
  dataLayers,
  sceneGraph,
  SceneDataLayerBase,
  SceneObjectStateChangedEvent,
  VizPanel,
  type SceneDataLayerProviderState,
  type SceneObject,
} from '@grafana/scenes';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import type { DashboardScene } from '../scene/DashboardScene';
import { dashboardComposerEnabled } from '../scene/dashboardModes';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { DashboardStateChangedEvent } from '../sidebar/events';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { type ComposerExitReason } from '../utils/dashboardModeTracking';
import { DashboardInteractions } from '../utils/interactions';
import { getPanelIdForVizPanel } from '../utils/utils-panels';
import { dashboardV2SpecSchema } from '../v2schema/dashboardV2Schema';

import { type ComposerDocument, type ComposerDocumentEvents } from './ComposerDocument';
import type { ComposerSession } from './ComposerSession';
import { canStillEdit } from './composerAccess';
import {
  type Box,
  clamp01,
  DATA_LAYER_CONTROL_SELECTOR,
  findCaptureRoot,
  PANEL_ROOT_SELECTOR,
  VARIABLE_CONTROL_SELECTOR,
} from './composerGeometry';
import {
  type ApplyOutcome,
  type ComposerApplyOptions,
  type ComposerDashboardSpec,
  type ComposerExitResult,
  type ComposerTarget,
  type ElementPick,
  type ElementPoint,
  type ElementRef,
  type RegionPick,
} from './types';

const MAX_INTERSECTS = 20;
const ORIGIN: ElementPoint = { x: 0, y: 0 };

/**
 * A dashboard as a Composer document. Writes go to the scene it was entered on only, never to whichever
 * mutation client is newest on the global stack (that can be a notebook).
 *
 * `revision` increases on every definition change, whatever its source: this session's applies, and
 * every edit action, undo or redo the dashboard records. A write prepared against an older revision is
 * refused, so Assistant never overwrites a change it has not read.
 */
export class DashboardComposerDocument implements ComposerDocument<ComposerDashboardSpec, ComposerSession> {
  public readonly target: ComposerTarget;
  public readonly elementSelector = PANEL_ROOT_SELECTOR;
  public readonly elementKeyAttribute = 'data-viz-panel-key';
  public readonly reportsSave = false;

  private revision = 0;
  private applying = false;
  private session?: ComposerSession;
  private events?: ComposerDocumentEvents;

  public constructor(private readonly scene: DashboardScene) {
    this.target = { resource: 'dashboard', uid: scene.state.uid ?? '' };
  }

  public elementHint(): string {
    return t('dashboard.composer.overlay.hint-panel', 'Click to comment on a panel, or drag to draw a region');
  }

  public attach(session: ComposerSession): boolean {
    this.session = session;
    return this.scene.enterComposerMode(session);
  }

  public start(events: ComposerDocumentEvents): () => void {
    this.events = events;
    const stateChanged = this.scene.subscribeToEvent(DashboardStateChangedEvent, () => {
      if (!this.applying) {
        this.revision++;
        events.layoutChanged();
      }
    });
    // Switching tabs mounts other panels and shows other regions without a definition change.
    const tabChanged = this.scene.subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
      if (payload.changedObject instanceof TabsLayoutManager && 'currentTabSlug' in payload.partialUpdate) {
        events.layoutChanged();
      }
    });
    return () => {
      stateChanged.unsubscribe();
      tabChanged.unsubscribe();
      this.events = undefined;
    };
  }

  public isEnabled(): boolean {
    return dashboardComposerEnabled();
  }

  public detach(reason: ComposerExitReason): void {
    this.scene.exitComposerMode(reason);
  }

  public async finish(): Promise<ComposerExitResult> {
    return {};
  }

  public getTrackingContext(): { editSessionId?: string; hasUnsavedChanges: boolean } {
    return { editSessionId: this.scene.getEditSessionId(), hasUnsavedChanges: Boolean(this.scene.state.isDirty) };
  }

  public readSpec(): { spec: ComposerDashboardSpec; revision: number } {
    return { spec: transformSceneToSaveModelSchemaV2(this.scene), revision: this.revision };
  }

  public async applySpec(
    spec: ComposerDashboardSpec,
    opts: ComposerApplyOptions,
    isOpen: () => boolean
  ): Promise<ApplyOutcome> {
    const startedAt = performance.now();
    const outcome = this.apply(spec, opts, isOpen);
    DashboardInteractions.composerSpecApplied({
      dashboard_uid: this.target.uid || undefined,
      composer_session_id: this.session?.sessionId,
      status: outcome.status,
      duration_ms: Math.round(performance.now() - startedAt),
    });
    return outcome;
  }

  /** Synchronous from the gate to the swap, so nothing can run between the checks and the write. */
  private apply(
    spec: ComposerDashboardSpec,
    { signal, baseRevision }: ComposerApplyOptions,
    isOpen: () => boolean
  ): ApplyOutcome {
    // 1. Prepare. Everything awaited or fallible-without-writing happens here.
    const parsed = dashboardV2SpecSchema.safeParse(spec);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      });
      return { status: 'invalid', message: `Validation failed: ${issues.join(', ')}` };
    }
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the parsed output is the v2 spec the transform expects
    const validSpec = parsed.data as unknown as ComposerDashboardSpec;

    // 2. Gate, synchronously: nothing below this line awaits, so nothing can run between the checks
    // and the write.
    const refusal = this.checkWrite(signal, baseRevision, isOpen);
    if (refusal) {
      return refusal;
    }

    // 3. Swap inside the edit session, so native undo and the change list see it.
    const body = this.scene.state.body;
    this.applying = true;
    try {
      // Edit actions only run while the sidebar is active.
      this.scene.activateSidebar();
      this.scene.withAssistantWrite(() =>
        applyDashboardSpec({
          scene: this.scene,
          spec: validSpec,
          description: t('dashboard.composer.apply-undo-title', 'Assistant Composer edit'),
          scope: 'composer',
        })
      );
    } catch (error) {
      return { status: 'invalid', message: error instanceof Error ? error.message : String(error) };
    } finally {
      this.applying = false;
    }
    if (this.scene.state.body === body) {
      // eslint-disable-next-line @grafana/i18n/no-untranslated-strings -- read by the Assistant model
      return { status: 'denied', message: 'The dashboard did not accept the edit.' };
    }
    this.revision++;
    this.events?.layoutChanged();
    // Restoring the saved spec (Assistant Undo) leaves nothing to save.
    this.scene.clearDirtyIfUnchanged();
    this.scene.recordEditMutation('assistant');
    this.scene.forceRender();
    return { status: 'applied', appliedSpec: transformSceneToSaveModelSchemaV2(this.scene), revision: this.revision };
  }

  /* eslint-disable @grafana/i18n/no-untranslated-strings -- outcome messages are read by the Assistant model, not shown in the UI */
  private checkWrite(signal: AbortSignal, baseRevision: number, isOpen: () => boolean): ApplyOutcome | undefined {
    if (!isOpen() || !this.scene.isActive || this.scene.getComposerSession() !== this.session) {
      return { status: 'closed', message: 'The Composer session has ended. Nothing was changed.' };
    }
    if (signal.aborted) {
      return { status: 'aborted', message: 'The request was stopped before the edit was applied.' };
    }
    if (!dashboardComposerEnabled()) {
      return { status: 'closed', message: 'Composer is turned off. Nothing was changed.' };
    }
    if (!canStillEdit(this.scene)) {
      return { status: 'denied', message: 'You no longer have permission to edit this dashboard.' };
    }
    if (baseRevision !== this.revision) {
      return {
        status: 'stale',
        message: `The dashboard changed since it was read (revision ${baseRevision}, now ${this.revision}). Read it again.`,
      };
    }
    return undefined;
  }
  /* eslint-enable @grafana/i18n/no-untranslated-strings */

  public findElementRoot(ref: ElementRef): HTMLElement | null {
    if (ref.kind === 'variable') {
      const key = sceneGraph.lookupVariable(ref.name, this.scene)?.state.key;
      return key
        ? document.querySelector<HTMLElement>(
            `${VARIABLE_CONTROL_SELECTOR}[data-dashboard-element-key="${CSS.escape(key)}"]`
          )
        : null;
    }
    if (ref.kind === 'annotation') {
      const key = this.findDataLayer(ref.name)?.state.key;
      return key ? controlRoot(DATA_LAYER_CONTROL_SELECTOR, key) : null;
    }
    const key = this.getPanelKey(ref);
    return key ? document.querySelector<HTMLElement>(`[data-viz-panel-key="${CSS.escape(key)}"]`) : null;
  }

  /**
   * Resolves the annotation or data layer whose control has `key`, by its name, pointing at the control's
   * top-right corner as a variable's pick does.
   */
  public resolveAnnotationPick(key: string): ElementPick | null {
    const found = sceneGraph.findObject(this.scene, (obj) => obj.state.key === key);
    if (!(found instanceof SceneDataLayerBase) || !found.state.name || this.findDataLayer(found.state.name) !== found) {
      return null;
    }
    return {
      ref: {
        kind: 'annotation',
        name: found.state.name,
        layerKind: found instanceof dataLayers.AnnotationsDataLayer ? 'annotation' : 'data-layer',
      },
      label: found.state.name,
      tabPath: [],
      point: { x: 1, y: 0 },
    };
  }

  /** The data layer named `name`: the first of that name, as the spec's annotations are listed. */
  private findDataLayer(name: string): SceneDataLayerBase<SceneDataLayerProviderState> | undefined {
    const found = sceneGraph.findObject(
      this.scene,
      (obj) => obj instanceof SceneDataLayerBase && obj.state.name === name
    );
    return found instanceof SceneDataLayerBase ? found : undefined;
  }

  public isHidden(ref: ElementRef): boolean {
    if (ref.kind !== 'panel') {
      return false;
    }
    const panel = this.findPanel(ref.panelId);
    return !panel || isInHiddenTab(panel);
  }

  /** Resolves the dashboard variable whose control has `key`, pointing at its top-right corner. */
  public resolveVariablePick(key: string): ElementPick | null {
    const found = sceneGraph.findObject(this.scene, (obj) => obj.state.key === key);
    const name = found && 'name' in found.state && typeof found.state.name === 'string' ? found.state.name : undefined;
    const variable = name ? sceneGraph.lookupVariable(name, this.scene) : null;
    if (!name || !variable || variable !== found) {
      return null;
    }
    return {
      ref: { kind: 'variable', name },
      label: variable.state.label || name,
      tabPath: [],
      point: { x: 1, y: 0 },
    };
  }

  /** Resolves the panel rendered under a `data-viz-panel-key` DOM root. */
  public resolveElementPick(key: string, point: ElementPoint = ORIGIN): ElementPick | null {
    const found = sceneGraph.findObject(this.scene, (obj) => obj.state.key === key);
    if (!(found instanceof VizPanel)) {
      return null;
    }
    // A repeat resolves to its source panel, which shares the id.
    const panelId = getPanelIdForVizPanel(found);
    if (!Number.isFinite(panelId)) {
      return null;
    }
    const source = this.findPanel(panelId) ?? found;
    return {
      ref: { kind: 'panel', panelId },
      label: source.state.title || t('dashboard.composer.untitled-panel', 'Panel {{panelId}}', { panelId }),
      tabPath: getTabPath(source),
      point: { x: clamp01(point.x), y: clamp01(point.y) },
    };
  }

  /** The DOM key of the panel a ref points at, for highlighting. */
  public getPanelKey(ref: ElementRef): string | undefined {
    return ref.kind === 'panel' ? this.findPanel(ref.panelId)?.state.key : undefined;
  }

  public regionContext(): { tabKeys: string[]; tabPath: string[]; timeRange: RegionPick['timeRange'] } {
    const tabs = getSelectedTabChain(this.scene);
    const timeRange = sceneGraph.getTimeRange(this.scene);
    return {
      tabKeys: tabs.map((tab) => tab.state.key ?? ''),
      tabPath: tabs.map((tab) => tab.state.title ?? ''),
      timeRange: {
        from: String(timeRange.state.from),
        to: String(timeRange.state.to),
        timezone: timeRange.getTimeZone(),
      },
    };
  }

  public isRegionShown(tabKeys: string[]): boolean {
    return tabKeys.every((key) => {
      const tab = sceneGraph.findObject(this.scene, (obj) => obj.state.key === key);
      return tab instanceof TabItem && isSelectedTab(tab);
    });
  }

  public findIntersectingElements(rect: Box, container: HTMLElement | null): Array<{ ref: ElementRef; label: string }> {
    const panels = this.findIntersectingPanels(rect);
    const variables = this.findIntersectingVariables(rect, container);
    return [...panels, ...variables].slice(0, MAX_INTERSECTS);
  }

  public findCaptureRoot(rect: Box, container: HTMLElement): HTMLElement {
    return findCaptureRoot(rect, container);
  }

  private findIntersectingVariables(
    rect: Box,
    container: HTMLElement | null
  ): Array<{ ref: ElementRef; label: string }> {
    const found = new Map<string, string>();
    for (const element of container?.querySelectorAll<HTMLElement>(VARIABLE_CONTROL_SELECTOR) ?? []) {
      const key = element.getAttribute('data-dashboard-element-key');
      const pick = key ? this.resolveVariablePick(key) : null;
      if (pick?.ref.kind === 'variable' && !found.has(pick.ref.name)) {
        const bounds = element.getBoundingClientRect();
        const overlapWidth = Math.min(rect.left + rect.width, bounds.right) - Math.max(rect.left, bounds.left);
        const overlapHeight = Math.min(rect.top + rect.height, bounds.bottom) - Math.max(rect.top, bounds.top);
        if (overlapWidth > 0 && overlapHeight > 0) {
          found.set(pick.ref.name, pick.label);
        }
      }
    }
    return [...found].map(([name, label]) => ({ ref: { kind: 'variable', name }, label }));
  }

  private findIntersectingPanels(rect: Box): Array<{ ref: ElementRef; label: string }> {
    const found = new Map<number, string>();
    for (const panel of this.scene.state.body.getVizPanels()) {
      if (found.size >= MAX_INTERSECTS) {
        break;
      }
      const key = panel.state.key;
      const element = key ? document.querySelector(`[data-viz-panel-key="${CSS.escape(key)}"]`) : null;
      const panelId = getPanelIdForVizPanel(panel);
      if (!element || !Number.isFinite(panelId) || found.has(panelId)) {
        continue;
      }
      const bounds = element.getBoundingClientRect();
      const overlapWidth = Math.min(rect.left + rect.width, bounds.right) - Math.max(rect.left, bounds.left);
      const overlapHeight = Math.min(rect.top + rect.height, bounds.bottom) - Math.max(rect.top, bounds.top);
      if (overlapWidth > 0 && overlapHeight > 0) {
        const source = this.findPanel(panelId) ?? panel;
        found.set(
          panelId,
          source.state.title || t('dashboard.composer.untitled-panel', 'Panel {{panelId}}', { panelId })
        );
      }
    }
    return [...found].map(([panelId, label]) => ({ ref: { kind: 'panel', panelId }, label }));
  }

  private findPanel(panelId: number): VizPanel | undefined {
    return this.scene.state.body
      .getVizPanels()
      .find((panel) => !isRepeatCloneOrChildOf(panel) && getPanelIdForVizPanel(panel) === panelId);
  }
}

/** The selected tab at each level of nested tabs under the dashboard body, outermost first. */
function getSelectedTabChain(scene: DashboardScene): TabItem[] {
  const chain: TabItem[] = [];
  let layout: unknown = scene.state.body;
  while (layout instanceof TabsLayoutManager) {
    const tab = layout.getCurrentTab();
    if (!tab) {
      break;
    }
    chain.push(tab);
    layout = tab.getLayout();
  }
  return chain;
}

/** Like `TabItem.isCurrentTab`, but also true for the first tab shown before any slug is set. */
function isSelectedTab(tab: TabItem): boolean {
  return tab.parent instanceof TabsLayoutManager && tab.parent.getCurrentTab() === tab;
}

function isInHiddenTab(obj: SceneObject): boolean {
  for (let parent = obj.parent; parent; parent = parent.parent) {
    if (parent instanceof TabItem && !isSelectedTab(parent)) {
      return true;
    }
  }
  return false;
}

function getTabPath(obj: SceneObject): string[] {
  const path: string[] = [];
  for (let parent = obj.parent; parent; parent = parent.parent) {
    if (parent instanceof TabItem) {
      path.unshift(parent.state.title ?? '');
    }
  }
  return path;
}

function controlRoot(selector: string, key: string): HTMLElement | null {
  const escaped = CSS.escape(key);
  const candidates = selector.split(',').map((part) => `${part.trim()}[data-dashboard-element-key="${escaped}"]`);
  return document.querySelector<HTMLElement>(candidates.join(', '));
}
