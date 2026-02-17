import { useCallback, useState } from 'react';

import { t } from '@grafana/i18n';
import { SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { Drawer } from '@grafana/ui';
import { VariableEditorForm } from 'app/features/dashboard-scene/settings/variables/VariableEditorForm';
import {
  EditableVariableType,
  getNextAvailableId,
  getVariableScene,
} from 'app/features/dashboard-scene/settings/variables/utils';
import { useDispatch } from 'app/types/store';

import { addSceneVariableAction, removeVariableAction, replaceVariableAction } from '../state/variables';

import { ExploreVariableTypeSelection } from './ExploreVariableTypeSelection';

type DrawerView = 'typeSelection' | 'editor';

interface Props {
  exploreId: string;
  variableSet: SceneVariableSet;
  onClose: () => void;
}

export function ExploreVariableEditor({ exploreId, variableSet, onClose }: Props) {
  const dispatch = useDispatch();
  const [view, setView] = useState<DrawerView>('typeSelection');
  const [editingVariable, setEditingVariable] = useState<SceneVariable | null>(null);

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

  const onDelete = useCallback(
    (variableName: string) => {
      dispatch(removeVariableAction({ exploreId, name: variableName }));
      onClose();
    },
    [dispatch, exploreId, onClose]
  );

  const onGoBack = useCallback(() => {
    onClose();
  }, [onClose]);

  const drawerTitle =
    view === 'typeSelection'
      ? t('explore.variable-editor.title-select-type', 'Select variable type')
      : t('explore.variable-editor.title-edit-variable', 'Edit variable');

  return (
    <Drawer title={drawerTitle} onClose={onClose} size="md">
      {view === 'typeSelection' && <ExploreVariableTypeSelection onSelect={onSelectType} onCancel={onClose} />}
      {view === 'editor' && editingVariable && (
        <VariableEditorForm
          variable={editingVariable}
          onTypeChange={onTypeChange}
          onGoBack={onGoBack}
          onDelete={onDelete}
          key={editingVariable.state.key}
        />
      )}
    </Drawer>
  );
}
