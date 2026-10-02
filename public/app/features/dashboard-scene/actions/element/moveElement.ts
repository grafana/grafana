import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { edit } from '../utils/edit';
import { getElementTypeName } from '../utils/getElementTypeName';

interface MoveElementActionHelperProps {
  movedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
  selectOnMove?: boolean;
}

export function moveElement(props: MoveElementActionHelperProps) {
  const { movedObject, source, perform, undo, selectOnMove } = props;

  const typeName = getElementTypeName(movedObject);
  if (typeName === undefined) {
    throw new Error('Moved object is not an editable element');
  }

  edit({
    description: t('dashboard.edit-actions.move', 'Move {{typeName}}', { typeName }),
    movedObject,
    selectOnMove,
    source,
    perform,
    undo,
  });
}
