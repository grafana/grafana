import { t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import {
  type ComposerDocument,
  type ComposerDocumentEvents,
} from 'app/features/dashboard-scene/composer/ComposerDocument';
import { ComposerSession } from 'app/features/dashboard-scene/composer/ComposerSession';
import { type Box, clamp01, findCaptureRoot, overlaps } from 'app/features/dashboard-scene/composer/composerGeometry';
import {
  type ApplyOutcome,
  type ComposerApplyOptions,
  type ComposerExitResult,
  type ComposerNotebookSpec,
  type ComposerTarget,
  type ElementPick,
  type ElementPoint,
  type ElementRef,
  type RegionPick,
} from 'app/features/dashboard-scene/composer/types';

import { applyNotebookSpec } from '../actions/applyNotebookSpec';
import { canEditNotebooks } from '../permissions';
import { type NotebookScene } from '../scene/NotebookScene';
import { type NotebookCellItem } from '../scene/layout-notebook/NotebookCellItem';
import { NOTEBOOK_CELL_KEY_ATTRIBUTE } from '../scene/layout-notebook/edit/cellClassNames';
import { transformNotebookSceneToSaveModel } from '../serialization/transformNotebookSceneToSaveModel';

import { canEnterNotebookComposer, getRouteNotebook, notebookComposerEnabled } from './notebookComposerAccess';

const CELL_SELECTOR = `[${NOTEBOOK_CELL_KEY_ATTRIBUTE}]`;
const MAX_INTERSECTS = 20;
const MAX_LABEL_LENGTH = 60;

type NotebookSession = ComposerSession<ComposerNotebookSpec>;

/** Enters Composer on the notebook its route renders. Throws when it cannot, with the reason. */
export function enterNotebookComposer(scene: NotebookScene): NotebookSession {
  const check = canEnterNotebookComposer(scene, { onRoute: scene === getRouteNotebook() });
  if (!check.ok) {
    throw new Error(`Composer is not available: ${check.reason}`);
  }
  return ComposerSession.open(new NotebookComposerDocument(scene));
}

/**
 * A notebook as a Composer document, on its own route.
 *
 * Its autosave is paused for the session (see `NotebookScene.enterComposer`), so applies stay unsaved the
 * way a dashboard's do, each one undoable on the notebook's own history. Ending the session by any path
 * makes the one save, through the usual autosave and conflict path, and reports how it went.
 *
 * The revision is the edit history's: applies, undo and redo move it, while the state changes a query
 * refresh or a reader's time range publish do not.
 */
export class NotebookComposerDocument implements ComposerDocument<ComposerNotebookSpec, NotebookSession> {
  public readonly target: ComposerTarget;
  public readonly elementSelector = CELL_SELECTOR;
  public readonly elementKeyAttribute = NOTEBOOK_CELL_KEY_ATTRIBUTE;
  public readonly reportsSave = true;

  private session?: NotebookSession;
  private events?: ComposerDocumentEvents;

  public constructor(private readonly scene: NotebookScene) {
    this.target = { resource: 'notebook', uid: scene.state.uid ?? '' };
  }

  public elementHint(): string {
    return t('notebook.composer.hint-cell', 'Click to comment on a cell, or drag to draw a region');
  }

  public attach(session: NotebookSession): boolean {
    this.session = session;
    return this.scene.enterComposer(session);
  }

  public start(events: ComposerDocumentEvents): () => void {
    this.events = events;
    // Undo, redo and applies change the cells without a resize the overlay would notice.
    const history = this.scene.editHistory.subscribeToState({ next: () => events.layoutChanged() });
    const body = this.scene.subscribeToState((state, previous) => {
      if (state.body !== previous.body) {
        events.layoutChanged();
      }
    });
    return () => {
      history.unsubscribe();
      body.unsubscribe();
      this.events = undefined;
    };
  }

  public isEnabled(): boolean {
    return notebookComposerEnabled();
  }

  public detach(): void {
    this.scene.exitComposer();
  }

  public async finish(): Promise<ComposerExitResult> {
    return { save: await this.scene.autosave.resume() };
  }

  public async retrySave(): Promise<ComposerExitResult> {
    return { save: await this.scene.autosave.retrySave() };
  }

  public readSpec(): { spec: ComposerNotebookSpec; revision: number } {
    return { spec: transformNotebookSceneToSaveModel(this.scene), revision: this.scene.editHistory.revision };
  }

  public async applySpec(
    spec: ComposerNotebookSpec,
    { signal, baseRevision, viewOnlyChanges }: ComposerApplyOptions,
    isOpen: () => boolean
  ): Promise<ApplyOutcome<ComposerNotebookSpec>> {
    let result;
    try {
      result = await applyNotebookSpec<ApplyOutcome<ComposerNotebookSpec>>(this.scene, spec, {
        validate: true,
        // Resolved at entry as dashboards do: the look on screen is the one Composer edits.
        viewOnlyChanges: viewOnlyChanges ?? 'keep',
        enterEditMode: false,
        gate: () => this.checkWrite(signal, baseRevision, isOpen),
      });
    } catch (error) {
      return { status: 'invalid', message: error instanceof Error ? error.message : String(error) };
    }
    switch (result.status) {
      case 'refused':
        return result.refusal;
      case 'invalid':
        return { status: 'invalid', message: result.error };
      case 'view_only_changes':
        // Unreachable: a resolution is always passed. Kept so the switch stays exhaustive.
        // eslint-disable-next-line @grafana/i18n/no-untranslated-strings -- read by the Assistant model
        return { status: 'invalid', message: 'The notebook has unresolved view-only changes.' };
    }
    // Held back until the session ends; the save status says the notebook has unsaved changes.
    this.scene.autosave.markDocumentChange();
    this.events?.layoutChanged();
    return {
      status: 'applied',
      appliedSpec: result.spec ?? transformNotebookSceneToSaveModel(this.scene),
      revision: this.scene.editHistory.revision,
    };
  }

  /* eslint-disable @grafana/i18n/no-untranslated-strings -- outcome messages are read by the Assistant model, not shown in the UI */
  private checkWrite(
    signal: AbortSignal,
    baseRevision: number,
    isOpen: () => boolean
  ): ApplyOutcome<ComposerNotebookSpec> | undefined {
    if (!isOpen() || !this.scene.isActive || this.scene.getComposerSession() !== this.session) {
      return { status: 'closed', message: 'The Composer session has ended. Nothing was changed.' };
    }
    if (signal.aborted) {
      return { status: 'aborted', message: 'The request was stopped before the edit was applied.' };
    }
    if (!notebookComposerEnabled()) {
      return { status: 'closed', message: 'Composer is turned off. Nothing was changed.' };
    }
    if (!canEditNotebooks()) {
      return { status: 'denied', message: 'You no longer have permission to edit this notebook.' };
    }
    const revision = this.scene.editHistory.revision;
    if (baseRevision !== revision) {
      return {
        status: 'stale',
        message: `The notebook changed since it was read (revision ${baseRevision}, now ${revision}). Read it again.`,
      };
    }
    return undefined;
  }
  /* eslint-enable @grafana/i18n/no-untranslated-strings */

  public resolveElementPick(key: string, point: ElementPoint): ElementPick | null {
    const cell = this.scene.state.body.state.cells.find((candidate) => candidate.state.key === key);
    if (!cell) {
      return null;
    }
    return {
      ref: { kind: 'cell', name: cell.state.elementName },
      label: getCellLabel(cell),
      tabPath: [],
      point: { x: clamp01(point.x), y: clamp01(point.y) },
    };
  }

  /**
   * Inside the overlay's container: the canvas can draw the same scene, with the same cell keys, elsewhere
   * on the page. A layout may reference one element from several cells; the first one is the element's.
   */
  public findElementRoot(ref: ElementRef, container: HTMLElement | null): HTMLElement | null {
    const key = ref.kind === 'cell' ? this.findCell(ref.name)?.state.key : undefined;
    return key
      ? (container ?? document).querySelector<HTMLElement>(`[${NOTEBOOK_CELL_KEY_ATTRIBUTE}="${CSS.escape(key)}"]`)
      : null;
  }

  public isHidden(ref: ElementRef): boolean {
    return ref.kind !== 'cell' || !this.findCell(ref.name);
  }

  public regionContext(): { tabKeys: string[]; tabPath: string[]; timeRange: RegionPick['timeRange'] } {
    const timeRange = sceneGraph.getTimeRange(this.scene);
    return {
      tabKeys: [],
      tabPath: [],
      timeRange: {
        from: String(timeRange.state.from),
        to: String(timeRange.state.to),
        timezone: timeRange.getTimeZone(),
      },
    };
  }

  /** A notebook has no tabs: a region always shows. */
  public isRegionShown(): boolean {
    return true;
  }

  public findIntersectingElements(rect: Box, container: HTMLElement | null): Array<{ ref: ElementRef; label: string }> {
    const found = new Map<string, string>();
    for (const element of container?.querySelectorAll<HTMLElement>(CELL_SELECTOR) ?? []) {
      if (found.size >= MAX_INTERSECTS) {
        break;
      }
      const key = element.getAttribute(NOTEBOOK_CELL_KEY_ATTRIBUTE);
      const pick = key ? this.resolveElementPick(key, { x: 0, y: 0 }) : null;
      if (pick?.ref.kind === 'cell' && !found.has(pick.ref.name) && overlaps(element.getBoundingClientRect(), rect)) {
        found.set(pick.ref.name, pick.label);
      }
    }
    return [...found].map(([name, label]) => ({ ref: { kind: 'cell', name }, label }));
  }

  public findCaptureRoot(rect: Box, container: HTMLElement): HTMLElement {
    return findCaptureRoot(rect, container, CELL_SELECTOR);
  }

  private findCell(elementName: string): NotebookCellItem | undefined {
    return this.scene.state.body.state.cells.find((cell) => cell.state.elementName === elementName);
  }
}

/** What a person would call the cell: its panel title, else its first line of text, else its kind. */
export function getCellLabel(cell: NotebookCellItem): string {
  const { body, content } = cell.state;
  if (body) {
    return body.state.title || t('notebook.composer.cell-visualization', 'Visualization');
  }
  if (content?.kind === 'Markdown') {
    return firstLine(content.spec.text.replace(/^[\s#>*+-]+|[*_`]/gm, '')) ?? t('notebook.composer.cell-text', 'Text');
  }
  if (content?.kind === 'Code') {
    return firstLine(content.spec.code) ?? t('notebook.composer.cell-code', 'Code');
  }
  return cell.state.elementName;
}

function firstLine(text: string): string | undefined {
  const line = text
    .split('\n')
    .map((candidate) => candidate.trim())
    .find(Boolean);
  if (!line) {
    return undefined;
  }
  return line.length > MAX_LABEL_LENGTH ? `${line.slice(0, MAX_LABEL_LENGTH - 1)}…` : line;
}
