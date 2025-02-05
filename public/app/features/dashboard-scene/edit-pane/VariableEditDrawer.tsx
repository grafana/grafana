import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  SceneVariable,
  SceneVariables,
} from '@grafana/scenes';
import { Drawer, Modal, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { VariableEditorForm } from '../settings/variables/VariableEditorForm';
import { RESERVED_GLOBAL_VARIABLE_NAME_REGEX, WORD_CHARACTERS_REGEX } from '../settings/variables/utils';
import { getDashboardSceneFor } from '../utils/utils';

export interface VariableEditDrawerState extends SceneObjectState {
  variableRef: SceneObjectRef<SceneVariable>;
}

export class VariableEditDrawer extends SceneObjectBase<VariableEditDrawerState> {
  public onClose = () => {
    getDashboardSceneFor(this).closeModal();
  };

  public onValidateVariableName = (name: string, key: string | undefined): [true, string] | [false, null] => {
    let errorText = null;
    if (!RESERVED_GLOBAL_VARIABLE_NAME_REGEX.test(name)) {
      errorText = "Template names cannot begin with '__', that's reserved for Grafana's global variables";
    }

    if (!WORD_CHARACTERS_REGEX.test(name)) {
      errorText = 'Only word characters are allowed in variable names';
    }

    const variable = this.getVariableSet().getByName(name)?.state;

    if (variable && variable.key !== key) {
      errorText = 'Variable with the same name already exists';
    }

    if (errorText) {
      return [true, errorText];
    }

    return [false, null];
  };

  public getVariableSet(): SceneVariables {
    return sceneGraph.getVariables(this);
  }

  static Component = ({ model }: SceneComponentProps<VariableEditDrawer>) => {
    const variable = model.state.variableRef?.resolve();
    const styles = useStyles2(getStyles);

    return (
      <Modal title={`Edit variable`} onDismiss={model.onClose} isOpen={true} className={styles.modal}>
        <VariableEditorForm
          variable={variable}
          onTypeChange={() => {}}
          onGoBack={model.onClose}
          onDelete={() => {}}
          onValidateVariableName={model.onValidateVariableName}
        />
      </Modal>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '80%',
    }),
  };
}
