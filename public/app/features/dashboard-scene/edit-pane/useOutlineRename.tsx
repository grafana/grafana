import React, { useState, useMemo } from 'react';

import { EditableDashboardElement } from '../scene/types/EditableDashboardElement';

export interface OutlineRenameState {
  isRenaming?: boolean;
  originalName?: string;
  error?: string;
}

export function useOutlineRename(editableElement: EditableDashboardElement) {
  const [state, setState] = useState<OutlineRenameState>({});

  const onNameDoubleClicked = (evt: React.MouseEvent) => {
    if (!editableElement.onChangeName) {
      return;
    }

    setState({ isRenaming: true, originalName: editableElement.getEditableElementInfo().instanceName });
  };

  const onInputBlur = () => {
    if (state.error) {
      editableElement.onChangeName!(state.originalName!);
    }

    setState({});
  };

  const renameInputRef = useMemo(() => {
    return (ref: HTMLInputElement | null) => {
      ref?.focus();
      ref?.select();
    };
  }, []);

  const onChangeName = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const result = editableElement.onChangeName!(evt.target.value);
    if (result?.errorMessage) {
      setState({ ...state, error: result.errorMessage });
    } else if (state.error) {
      setState({ ...state, error: undefined });
    }
  };

  const onInputKeyDown = (evt: React.KeyboardEvent) => {
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
