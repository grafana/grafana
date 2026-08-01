import { useCallback, useEffect, useRef, useState } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type Spec as NotebookSpec } from '@grafana/schema/apis/notebook/v2beta1';
import { appEvents } from 'app/core/app_events';
import { type Resource } from 'app/features/apiserver/types';

import { fetchNotebook, isConflictError, saveNotebook } from '../api/notebookAPI';

const AUTOSAVE_DEBOUNCE_MS = 1200;
const UNDO_STACK_LIMIT = 100;
/** Edits closer together than this collapse into one undo step (e.g. typing bursts). */
const UNDO_COALESCE_MS = 800;

interface NotebookEditorState {
  resource?: Resource<NotebookSpec>;
  spec?: NotebookSpec;
  loading: boolean;
  loadError?: unknown;
  saving: boolean;
  dirty: boolean;
  lastSavedAt?: number;
  canUndo: boolean;
  canRedo: boolean;
}

export interface NotebookEditorApi {
  state: NotebookEditorState;
  /** Applies a local edit. Marks the document dirty and schedules an autosave. */
  updateSpec: (mutate: (spec: NotebookSpec) => NotebookSpec) => void;
  /** Applies a document received from a collaborator. Does not trigger an autosave on this client. */
  applyRemoteSpec: (spec: NotebookSpec) => void;
  /** Reverts the most recent local edit step. Returns true when something was undone. */
  undo: () => boolean;
  /** Re-applies the most recently undone step. Returns true when something was redone. */
  redo: () => boolean;
  save: () => Promise<void>;
  /** Latest working copy, readable from event handlers without stale closures. */
  getSpec: () => NotebookSpec | undefined;
}

/**
 * Owns the notebook editor working copy: load, local edits, remote (collaborative)
 * edits and debounced autosave with optimistic-concurrency conflict retry.
 */
export function useNotebookEditorState(uid: string): NotebookEditorApi {
  const [state, setState] = useState<NotebookEditorState>({
    loading: true,
    saving: false,
    dirty: false,
    canUndo: false,
    canRedo: false,
  });

  // Refs mirror the parts of the state that async flows (autosave, collab) need
  // to read without re-subscribing on every keystroke.
  const specRef = useRef<NotebookSpec | undefined>(undefined);
  const resourceRef = useRef<Resource<NotebookSpec> | undefined>(undefined);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>();

  // Snapshot-based local history. Remote (collaborator) documents never enter the
  // stacks: undo always steps through this user's own edits.
  const undoStack = useRef<NotebookSpec[]>([]);
  const redoStack = useRef<NotebookSpec[]>([]);
  const lastUndoPushAt = useRef(0);

  useEffect(() => {
    let cancelled = false;
    undoStack.current = [];
    redoStack.current = [];
    setState({ loading: true, saving: false, dirty: false, canUndo: false, canRedo: false });

    fetchNotebook(uid)
      .then((resource) => {
        if (cancelled) {
          return;
        }
        specRef.current = resource.spec;
        resourceRef.current = resource;
        setState({
          resource,
          spec: resource.spec,
          loading: false,
          saving: false,
          dirty: false,
          canUndo: false,
          canRedo: false,
        });
      })
      .catch((loadError) => {
        if (!cancelled) {
          setState({ loading: false, saving: false, dirty: false, loadError, canUndo: false, canRedo: false });
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(autosaveTimer.current);
      // Flush edits still waiting on the autosave debounce so navigating away
      // (Done button, breadcrumbs) never drops the last keystrokes.
      if (dirtyRef.current && resourceRef.current && specRef.current) {
        dirtyRef.current = false;
        saveNotebook({ ...resourceRef.current, spec: specRef.current }).catch(() => {});
      }
    };
  }, [uid]);

  const save = useCallback(async () => {
    const resource = resourceRef.current;
    const specAtStart = specRef.current;
    if (!resource || !specAtStart || savingRef.current) {
      return;
    }

    savingRef.current = true;
    setState((s) => ({ ...s, saving: true }));

    try {
      let saved: Resource<NotebookSpec>;
      try {
        saved = await saveNotebook({ ...resource, spec: specAtStart });
      } catch (error) {
        if (!isConflictError(error)) {
          throw error;
        }
        // A collaborator saved since our last write. Live sync keeps working copies
        // converged, so adopt the latest metadata (resourceVersion) and retry once.
        const latest = await fetchNotebook(uid);
        saved = await saveNotebook({ ...latest, spec: specRef.current ?? specAtStart });
      }

      resourceRef.current = saved;
      // Edits may have landed while the request was in flight; stay dirty in that case.
      const stillDirty = specRef.current !== specAtStart;
      dirtyRef.current = stillDirty;
      setState((s) => ({
        ...s,
        resource: saved,
        saving: false,
        dirty: stillDirty,
        lastSavedAt: Date.now(),
      }));
      if (stillDirty) {
        scheduleAutosave();
      }
    } catch (error) {
      setState((s) => ({ ...s, saving: false }));
      appEvents.emit(AppEvents.alertError, [
        t('notebooks.editor.save-failed', 'Failed to save notebook'),
        error instanceof Error ? error.message : '',
      ]);
    } finally {
      savingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scheduleAutosave is stable (defined below with the same deps)
  }, [uid]);

  const scheduleAutosave = useCallback(() => {
    clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      save();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [save]);

  const updateSpec = useCallback(
    (mutate: (spec: NotebookSpec) => NotebookSpec) => {
      const current = specRef.current;
      if (!current) {
        return;
      }
      const next = mutate(current);
      if (next === current) {
        return;
      }

      // Coalesce rapid successive edits (typing) into a single undo step.
      const now = Date.now();
      if (undoStack.current.length === 0 || now - lastUndoPushAt.current > UNDO_COALESCE_MS) {
        undoStack.current.push(current);
        if (undoStack.current.length > UNDO_STACK_LIMIT) {
          undoStack.current.shift();
        }
      }
      lastUndoPushAt.current = now;
      redoStack.current = [];

      specRef.current = next;
      dirtyRef.current = true;
      setState((s) => ({ ...s, spec: next, dirty: true, canUndo: true, canRedo: false }));
      scheduleAutosave();
    },
    [scheduleAutosave]
  );

  const applyHistorySpec = useCallback(
    (spec: NotebookSpec) => {
      specRef.current = spec;
      dirtyRef.current = true;
      setState((s) => ({
        ...s,
        spec,
        dirty: true,
        canUndo: undoStack.current.length > 0,
        canRedo: redoStack.current.length > 0,
      }));
      scheduleAutosave();
    },
    [scheduleAutosave]
  );

  const undo = useCallback(() => {
    const previous = undoStack.current.pop();
    const current = specRef.current;
    if (!previous || !current) {
      return false;
    }
    redoStack.current.push(current);
    // The next edit after an undo starts a fresh step instead of coalescing into it.
    lastUndoPushAt.current = 0;
    applyHistorySpec(previous);
    return true;
  }, [applyHistorySpec]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    const current = specRef.current;
    if (!next || !current) {
      return false;
    }
    undoStack.current.push(current);
    lastUndoPushAt.current = 0;
    applyHistorySpec(next);
    return true;
  }, [applyHistorySpec]);

  const applyRemoteSpec = useCallback((spec: NotebookSpec) => {
    specRef.current = spec;
    // Remote specs are the sender's responsibility to persist; applying one here
    // must not schedule an autosave, or every participant would race PUTs.
    setState((s) => ({ ...s, spec }));
  }, []);

  const getSpec = useCallback(() => specRef.current, []);

  return { state, updateSpec, applyRemoteSpec, undo, redo, save, getSpec };
}
