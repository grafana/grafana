import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { edit } from '../utils/edit';
import { getEditableElementFor } from '../utils/getEditableElementFor';

interface MoveElementActionHelperProps {
  movedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
}

export function moveElement(props: MoveElementActionHelperProps) {
  const { movedObject, source, perform, undo } = props;

  const element = getEditableElementFor(movedObject);
  if (!element) {
    throw new Error('Moved object is not an editable element');
  }

  const typeName = element.getEditableElementInfo().typeName;

  edit({
    description: t('dashboard.edit-actions.move', 'Move {{typeName}}', { typeName }),
    movedObject,
    source,
    perform,
    undo,
  });
}
