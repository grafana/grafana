import { type MouseEvent, type ChangeEvent, type KeyboardEvent, useState, useMemo, useRef } from 'react';

import { type SceneObject } from '@grafana/scenes';

import { renameElement } from '../actions/element/renameElement';
import { type EditableDashboardElement } from '../scene/types/EditableDashboardElement';

export interface OutlineRenameState {
  isRenaming?: boolean;
  originalName?: string;
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
    setState({ isRenaming: true, originalName: getRawName(sceneObject, editableElement) });
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
    const result = editableElement.onChangeName!(evt.target.value);
    if (result?.errorMessage) {
      setState({ ...state, error: result.errorMessage });
    } else if (state.error) {
      setState({ ...state, error: undefined });
    }
  };

  const onInputKeyDown = (evt: KeyboardEvent) => {
    if (evt.key === 'Enter') {
      onInputBlur();
    }
  };

  return {
    isRenaming: state.isRenaming,
    onNameDoubleClicked,
    renameInputRef,
    onChangeName,
    onInputBlur,
    onInputKeyDown,
  };
}

/**
 * The displayed name of panels, rows and tabs has variables interpolated, undo has to restore the raw title
 */
function getRawName(sceneObject: SceneObject, editableElement: EditableDashboardElement): string {
  const { state } = sceneObject;
  if ('title' in state && typeof state.title === 'string') {
    return state.title;
  }

  return editableElement.getEditableElementInfo().instanceName;
}
