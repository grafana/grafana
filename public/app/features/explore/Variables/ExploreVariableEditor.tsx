import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { CustomVariable, SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { ConfirmModal, Drawer } from '@grafana/ui';
import { VariableEditorForm } from 'app/features/dashboard-scene/settings/variables/VariableEditorForm';
import { getNextAvailableId } from 'app/features/dashboard-scene/settings/variables/utils';
import { useDispatch } from 'app/types/store';

import { addSceneVariableAction, removeVariableAction } from '../state/variables';

import { ExploreVariableListView } from './ExploreVariableListView';

type DrawerView = 'list' | 'editor';

interface Props {
  exploreId: string;
  variableSet: SceneVariableSet;
  initialView?: 'list' | 'editor';
  onClose: () => void;
}

export function ExploreVariableEditor({ exploreId, variableSet, initialView: initialViewProp, onClose }: Props) {
  const dispatch = useDispatch();
  const variables = variableSet.state.variables;
  const hasVariables = variables.length > 0;

  const computedInitialView: DrawerView = initialViewProp === 'list' && hasVariables ? 'list' : 'editor';
  const [view, setView] = useState<DrawerView>(computedInitialView);
  const [editingVariable, setEditingVariable] = useState<SceneVariable | null>(() => {
    if (computedInitialView === 'editor') {
      const name = getNextAvailableId('custom', variableSet.state.variables);
      const variable = new CustomVariable({ name, allowCustomValue: true });
      dispatch(addSceneVariableAction({ exploreId, variable }));
      return variable;
    }
    return null;
  });
  const [deleteTarget, setDeleteTarget] = useState<SceneVariable | null>(null);

  const onConfirmDelete = useCallback(
    (variable: SceneVariable) => {
      dispatch(removeVariableAction({ exploreId, name: variable.state.name }));
      setDeleteTarget(null);
      if (view === 'editor') {
        setEditingVariable(null);
        setView('list');
      }
    },
    [dispatch, exploreId, view]
  );

  const onDeleteFromEditor = useCallback(
    (_variableName: string) => {
      if (editingVariable) {
        setDeleteTarget(editingVariable);
      }
    },
    [editingVariable]
  );

  const onDeleteFromList = useCallback((variable: SceneVariable) => {
    setDeleteTarget(variable);
  }, []);

  const onEditFromList = useCallback((variable: SceneVariable) => {
    setEditingVariable(variable);
    setView('editor');
  }, []);

  const onGoBack = useCallback(() => {
    setEditingVariable(null);
    if (hasVariables) {
      setView('list');
    } else {
      onClose();
    }
  }, [hasVariables, onClose]);

  const onAddFromList = useCallback(() => {
    const name = getNextAvailableId('custom', variableSet.state.variables);
    const variable = new CustomVariable({ name, allowCustomValue: true });
    dispatch(addSceneVariableAction({ exploreId, variable }));
    setEditingVariable(variable);
    setView('editor');
  }, [dispatch, exploreId, variableSet]);

  const drawerTitle =
    view === 'list'
      ? t('explore.variable-editor.title-variables', 'Variables')
      : t('explore.variable-editor.title-edit-variable', 'Edit variable');

  return (
    <>
      <Drawer title={drawerTitle} onClose={onClose} size="md">
        {view === 'list' && (
          <ExploreVariableListView
            variables={variables}
            onEdit={onEditFromList}
            onDelete={onDeleteFromList}
            onAdd={onAddFromList}
          />
        )}
        {view === 'editor' && editingVariable && (
          <VariableEditorForm
            variable={editingVariable}
            onGoBack={onGoBack}
            onDelete={onDeleteFromEditor}
            key={editingVariable.state.key}
          />
        )}
      </Drawer>
      {deleteTarget && (
        <ConfirmModal
          isOpen
          title={t('explore.variable-editor.delete-title', 'Delete variable')}
          body={t('explore.variable-editor.delete-body', 'Are you sure you want to delete the variable "{{name}}"?', {
            name: deleteTarget.state.name,
          })}
          confirmText={t('explore.variable-editor.delete-confirm', 'Delete')}
          onConfirm={() => onConfirmDelete(deleteTarget)}
          onDismiss={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
