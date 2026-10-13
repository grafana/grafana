import { ClientProviderEvents } from '@openfeature/web-sdk';

import { t } from '@grafana/i18n';
import { getFeatureFlagClient } from '@grafana/runtime/internal';
import { sceneGraph, VizPanel, type SceneObject } from '@grafana/scenes';
import { appEvents } from 'app/core/app_events';
import { SetExtensionSidebarPresentationEvent } from 'app/types/events';

import { applyDashboardSpec } from '../actions/dashboard/applyDashboardSpec';
import type { DashboardScene } from '../scene/DashboardScene';
import { dashboardComposerEnabled } from '../scene/dashboardModes';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';
import { DashboardStateChangedEvent } from '../sidebar/events';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { getPanelIdForVizPanel } from '../utils/utils-panels';
import { dashboardV2SpecSchema } from '../v2schema/dashboardV2Schema';

import { canEnterComposer, canStillEdit } from './composerAccess';
import {
  type ApplyOutcome,
  type ComposerDashboardSpec,
  type ComposerElement,
  type ComposerSessionAPI,
  type ElementPick,
  type ElementRef,
  type RegionPick,
} from './types';

/** What the overlay renders. A new object on every change, for `useSyncExternalStore`. */
export interface ComposerOverlayState {
  picking: boolean;
  paused: boolean;
  highlight: ElementRef | null;
}

/**
 * One Composer session, bound to the dashboard it was entered on. Writes go to that scene only,
 * never to whichever mutation client is newest on the global stack (that can be a notebook).
 *
 * `revision` increases on every definition change, whatever its source: this session's applies, and
 * every edit action, undo or redo the dashboard records. A write prepared against an older revision is
 * refused, so Assistant never overwrites a change it has not read.
 */
export class ComposerSession implements ComposerSessionAPI {
  public readonly dashboardUid: string;

  private readonly controller = new AbortController();
  private revision = 0;
  private applying = false;
  private closed = false;
  private pendingPick?: (pick: ElementPick | null) => void;
  private overlayState: ComposerOverlayState = { picking: false, paused: false, highlight: null };
  private readonly listeners = new Set<() => void>();
  private readonly cleanups: Array<() => void> = [];

  /** Enters Composer on `scene`. Throws when it cannot, with the reason `canEnterComposer` gives. */
  public static enter(scene: DashboardScene | null): ComposerSession {
    const check = canEnterComposer(scene);
    if (!check.ok || !scene) {
      throw new Error(`Composer is not available: ${check.ok ? 'not_dashboard' : check.reason}`);
    }
    const session = new ComposerSession(scene);
    if (!scene.enterComposerMode(session)) {
      throw new Error('Composer is not available: unsupported');
    }
    session.start();
    return session;
  }

  private constructor(private readonly scene: DashboardScene) {
    this.dashboardUid = scene.state.uid ?? '';
  }

  public get signal(): AbortSignal {
    return this.controller.signal;
  }

  private start() {
    const stateChanged = this.scene.subscribeToEvent(DashboardStateChangedEvent, () => {
      if (!this.applying) {
        this.revision++;
      }
    });
    this.cleanups.push(() => stateChanged.unsubscribe());

    // Turning the flag off ends the session; unsaved edits stay.
    const client = getFeatureFlagClient();
    const onFlagsChanged = () => {
      if (!dashboardComposerEnabled()) {
        this.exit();
      }
    };
    client.addHandler(ClientProviderEvents.ConfigurationChanged, onFlagsChanged);
    this.cleanups.push(() => client.removeHandler(ClientProviderEvents.ConfigurationChanged, onFlagsChanged));

    appEvents.publish(new SetExtensionSidebarPresentationEvent({ presentation: 'floating' }));
  }

  public pickElement(signal: AbortSignal): Promise<ElementPick | null> {
    this.cancelPick();
    if (this.closed || this.overlayState.paused || signal.aborted) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      const onAbort = () => this.completePick(null);
      signal.addEventListener('abort', onAbort, { once: true });
      this.pendingPick = (pick) => {
        signal.removeEventListener('abort', onAbort);
        resolve(pick);
      };
      this.setOverlayState({ picking: true });
    });
  }

  public pickRegion(_signal: AbortSignal, _start?: PointerEvent): Promise<RegionPick | null> {
    return Promise.resolve(null);
  }

  public listElements(): ComposerElement[] {
    return [];
  }

  public highlight(target: ElementRef | null): void {
    if (!this.closed) {
      this.setOverlayState({ highlight: target });
    }
  }

  public setPaused(paused: boolean): void {
    if (this.closed) {
      return;
    }
    if (paused) {
      this.cancelPick();
    }
    this.setOverlayState({ paused });
  }

  public async readSpec(): Promise<{ spec: ComposerDashboardSpec; revision: number }> {
    if (this.closed) {
      throw new Error('The Composer session has ended.');
    }
    return { spec: transformSceneToSaveModelSchemaV2(this.scene), revision: this.revision };
  }

  public async applySpec(
    spec: ComposerDashboardSpec,
    { signal, baseRevision }: { signal: AbortSignal; baseRevision: number }
  ): Promise<ApplyOutcome> {
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
    const refusal = this.checkWrite(signal, baseRevision);
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
    this.scene.recordEditMutation('assistant');
    this.scene.forceRender();
    return { status: 'applied', appliedSpec: transformSceneToSaveModelSchemaV2(this.scene), revision: this.revision };
  }

  /* eslint-disable @grafana/i18n/no-untranslated-strings -- outcome messages are read by the Assistant model, not shown in the UI */
  private checkWrite(signal: AbortSignal, baseRevision: number): ApplyOutcome | undefined {
    if (this.closed || !this.scene.isActive || this.scene.getComposerSession() !== this) {
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

  public exit(): void {
    if (this.closed) {
      return;
    }
    this.scene.exitComposerMode();
    // The scene closes the session when its mode changes; this covers a scene already out of Composer.
    this.close();
  }

  /** @internal Called by the scene when it leaves Composer, and by `exit`. */
  public close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.cancelPick();
    this.controller.abort();
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
    this.overlayState = { picking: false, paused: false, highlight: null };
    this.notify();
    appEvents.publish(new SetExtensionSidebarPresentationEvent({ presentation: 'docked' }));
  }

  public get isClosed(): boolean {
    return this.closed;
  }

  /** @internal The overlay's view of the session. */
  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** @internal */
  public getOverlayState = (): ComposerOverlayState => this.overlayState;

  /** @internal The overlay resolves the active pick, or cancels it with null. */
  public completePick(pick: ElementPick | null): void {
    const resolve = this.pendingPick;
    if (!resolve) {
      return;
    }
    this.pendingPick = undefined;
    if (!this.closed) {
      this.setOverlayState({ picking: false });
    }
    resolve(pick);
  }

  /** @internal Resolves the panel rendered under a `data-viz-panel-key` DOM root. */
  public resolvePanelPick(key: string): ElementPick | null {
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
    };
  }

  /** @internal The DOM key of the panel a ref points at, for highlighting. */
  public getPanelKey(ref: ElementRef): string | undefined {
    return ref.kind === 'panel' ? this.findPanel(ref.panelId)?.state.key : undefined;
  }

  private findPanel(panelId: number): VizPanel | undefined {
    return this.scene.state.body
      .getVizPanels()
      .find((panel) => !isRepeatCloneOrChildOf(panel) && getPanelIdForVizPanel(panel) === panelId);
  }

  private cancelPick() {
    this.completePick(null);
  }

  private setOverlayState(update: Partial<ComposerOverlayState>) {
    this.overlayState = { ...this.overlayState, ...update };
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
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
