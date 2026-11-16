import { type MouseEvent, type ChangeEvent, type KeyboardEvent, useState, useMemo, useRef } from 'react';

import { type SceneObject } from '@grafana/scenes';

import { renameElement } from '../actions/element/renameElement';
import { type EditableDashboardElement } from '../scene/types/EditableDashboardElement';
import { isSceneVariable } from '../settings/variables/utils';

export interface OutlineRenameState {
  isRenaming?: boolean;
  originalName?: string;
  draftName?: string;
  error?: string;
}

export function useOutlineRename(
  sceneObject: SceneObject,
  editableElement: EditableDashboardElement,
  isEditing: boolean | undefined
) {
  const [state, setState] = useState<OutlineRenameState>({});
  // Enter commits and unmounts the input, which can fire blur too; commit only once to avoid a duplicate undo entry.
  const isCommitPendingRef = useRef(false);

  const onNameDoubleClicked = (evt: MouseEvent) => {
    if (!isEditing) {
      return;
    }

    // The rename input is rendered inside the double-clickable button, keep the original name while renaming
    if (!editableElement.onChangeName || state.isRenaming) {
      return;
    }

    isCommitPendingRef.current = true;
    const originalName = getRawName(sceneObject, editableElement);
    setState({ isRenaming: true, originalName, draftName: originalName });
  };

  const onInputBlur = () => {
    if (!isCommitPendingRef.current) {
      return;
    }
    isCommitPendingRef.current = false;

    const newName = getRawName(sceneObject, editableElement);

    if (state.error) {
      editableElement.onChangeName!(state.originalName!);
    } else if (state.originalName !== undefined && newName !== state.originalName) {
      renameElement({ source: sceneObject, element: editableElement, oldName: state.originalName, newName });
    } else {
      editableElement.onCommitName?.();
    }

    setState({});
  };

  const renameInputRef = useMemo(() => {
    return (ref: HTMLInputElement | null) => {
      ref?.focus();
      ref?.select();
    };
  }, []);

  const onChangeName = (evt: ChangeEvent<HTMLInputElement>) => {
    const draftName = evt.target.value;
    const result = editableElement.onChangeName!(draftName);
    // The outline node does not re-render on scene object state changes, so the input reads the draft from here
    setState((prev) => ({ ...prev, draftName, error: result?.errorMessage }));
  };

  const onInputKeyDown = (evt: KeyboardEvent) => {
    if (evt.key === 'Enter') {
      onInputBlur();
    }
  };

  return {
    isRenaming: state.isRenaming,
    draftName: state.draftName ?? '',
    onNameDoubleClicked,
    renameInputRef,
    onChangeName,
    onInputBlur,
    onInputKeyDown,
  };
}

/**
 * The name that onChangeName writes, which can differ from the displayed instanceName:
 * variables display their label, and panels, rows and tabs display their title with variables interpolated.
 */
function getRawName(sceneObject: SceneObject, editableElement: EditableDashboardElement): string {
  if (isSceneVariable(sceneObject)) {
    return sceneObject.state.name;
  }

  const { state } = sceneObject;
  if ('title' in state && typeof state.title === 'string') {
    return state.title;
  }

  return editableElement.getEditableElementInfo().instanceName;
}
