import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { type DashboardActionMeta } from '../../sidebar/events';
import { edit } from '../utils/edit';
import { getElementTypeName } from '../utils/getElementTypeName';

interface MoveElementActionHelperProps {
  meta: DashboardActionMeta;
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
    meta: props.meta,
    description: t('dashboard.edit-actions.move', 'Move {{typeName}}', { typeName }),
    movedObject,
    selectOnMove,
    source,
    perform,
    undo,
  });
}
