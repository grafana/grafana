import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { ConfirmModal, Drawer } from '@grafana/ui';
import { VariableEditorForm } from 'app/features/dashboard-scene/settings/variables/VariableEditorForm';
import {
  EditableVariableType,
  getNextAvailableId,
  getVariableScene,
} from 'app/features/dashboard-scene/settings/variables/utils';
import { useDispatch } from 'app/types/store';

import { addSceneVariableAction, removeVariableAction, replaceVariableAction } from '../state/variables';

import { ExploreVariableListView } from './ExploreVariableListView';
import { ExploreVariableTypeSelection } from './ExploreVariableTypeSelection';

type DrawerView = 'list' | 'typeSelection' | 'editor';

interface Props {
  exploreId: string;
  variableSet: SceneVariableSet;
  initialVariable?: SceneVariable | null;
  onClose: () => void;
}

export function ExploreVariableEditor({ exploreId, variableSet, initialVariable, onClose }: Props) {
  const dispatch = useDispatch();
  const variables = variableSet.state.variables;
  const hasVariables = variables.length > 0;

  const initialView: DrawerView = initialVariable ? 'editor' : hasVariables ? 'list' : 'typeSelection';
  const [view, setView] = useState<DrawerView>(initialView);
  const [editingVariable, setEditingVariable] = useState<SceneVariable | null>(initialVariable ?? null);
  const [deleteTarget, setDeleteTarget] = useState<SceneVariable | null>(null);

  const onSelectType = useCallback(
    (type: EditableVariableType) => {
      const name = getNextAvailableId(type, variableSet.state.variables);
      const variable = getVariableScene(type, { name });
      dispatch(addSceneVariableAction({ exploreId, variable }));
      setEditingVariable(variable);
      setView('editor');
    },
    [dispatch, exploreId, variableSet]
  );

  const onTypeChange = useCallback(
    (type: EditableVariableType) => {
      if (!editingVariable) {
        return;
      }
      const { name, label } = editingVariable.state;
      const newVariable = getVariableScene(type, { name, label });
      dispatch(replaceVariableAction({ exploreId, oldName: name, variable: newVariable }));
      setEditingVariable(newVariable);
    },
    [dispatch, exploreId, editingVariable]
  );

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
    setView('typeSelection');
  }, []);

  const drawerTitle =
    view === 'list'
      ? t('explore.variable-editor.title-variables', 'Variables')
      : view === 'typeSelection'
        ? t('explore.variable-editor.title-select-type', 'Select variable type')
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
        {view === 'typeSelection' && (
          <ExploreVariableTypeSelection
            onSelect={onSelectType}
            onCancel={hasVariables ? () => setView('list') : onClose}
          />
        )}
        {view === 'editor' && editingVariable && (
          <VariableEditorForm
            variable={editingVariable}
            onTypeChange={onTypeChange}
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
