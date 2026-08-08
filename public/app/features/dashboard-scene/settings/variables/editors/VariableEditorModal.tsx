import { CustomVariable, QueryVariable, type SceneVariable } from '@grafana/scenes';

import { ModalEditor as CustomVariableEditorModal } from './CustomVariableEditor/ModalEditor';
import { QueryVariableEditorModal } from './QueryVariableEditor/QueryVariableEditorModal';

/**
 * Renders the modal editor matching the variable type, used by the controls
 * "Edit query" / "Edit options" actions and the sidebar edit pane.
 */
export function VariableEditorModal({ variable, onClose }: { variable: SceneVariable; onClose: () => void }) {
  if (variable instanceof QueryVariable) {
    return <QueryVariableEditorModal variable={variable} onClose={onClose} />;
  }

  if (variable instanceof CustomVariable) {
    return <CustomVariableEditorModal variable={variable} onClose={onClose} />;
  }

  return null;
}
