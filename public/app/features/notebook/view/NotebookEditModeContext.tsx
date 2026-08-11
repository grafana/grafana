import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { canEditNotebooks } from '../permissions';
import { NOTEBOOK_EDIT_PARAM, NOTEBOOK_EDIT_PARAM_ON } from '../urls';

interface NotebookEditMode {
  isEditing: boolean;
  /** No-op for a user without edit permission, so the mode can't be forced from the UI or the URL. */
  setIsEditing: (editing: boolean) => void;
  /** Whether this user may edit at all — drives whether the toggle is offered. */
  canEdit: boolean;
}

const NotebookEditModeContext = createContext<NotebookEditMode | undefined>(undefined);

/**
 * Whether the notebook is being viewed or edited. This is runtime state only: nothing is saved yet,
 * and the document does not become editable — it is the seam that later work hangs off, and a
 * temporary one pending design.
 *
 * The URL seeds the state and is kept in step with it, so that the list page's Edit action can land
 * straight in edit mode and a reload or a copied link preserves which mode you were in.
 */
export function NotebookEditModeProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Read once for the initial value: the URL seeds the state, it does not drive it. Deriving on
  // every render would fight setIsEditing, which is what actually owns the mode.
  const [isEditing, setEditing] = useState(
    () => searchParams.get(NOTEBOOK_EDIT_PARAM) === NOTEBOOK_EDIT_PARAM_ON && canEditNotebooks()
  );

  // Checked here rather than only where the toggle renders, so a hand-typed ?edit=true does nothing
  // for a user without permission.
  const canEdit = canEditNotebooks();

  const setIsEditing = useCallback(
    (editing: boolean) => {
      if (editing && !canEdit) {
        return;
      }

      setEditing(editing);
      setSearchParams(
        (params) => {
          if (editing) {
            params.set(NOTEBOOK_EDIT_PARAM, NOTEBOOK_EDIT_PARAM_ON);
          } else {
            params.delete(NOTEBOOK_EDIT_PARAM);
          }
          return params;
        },
        // Replace rather than push: flipping the toggle is not a navigation, and pushing would make
        // the back button undo toggles instead of leaving the notebook.
        { replace: true }
      );
    },
    [canEdit, setSearchParams]
  );

  const value = useMemo(() => ({ isEditing, setIsEditing, canEdit }), [isEditing, setIsEditing, canEdit]);

  return <NotebookEditModeContext.Provider value={value}>{children}</NotebookEditModeContext.Provider>;
}

export function useNotebookEditMode(): NotebookEditMode {
  const context = useContext(NotebookEditModeContext);

  if (!context) {
    throw new Error('useNotebookEditMode must be used within a NotebookEditModeProvider');
  }

  return context;
}
