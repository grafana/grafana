import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { type DashboardActionTracking } from '../../sidebar/events';
import { edit } from '../utils/edit';
import { getElementTypeName } from '../utils/getElementTypeName';

interface RemoveElementActionHelperProps {
  tracking?: DashboardActionTracking;
  removedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
}

export function removeElement(props: RemoveElementActionHelperProps) {
  const { removedObject, source, perform, undo } = props;

  const typeName = getElementTypeName(removedObject);
  if (typeName === undefined) {
    throw new Error('Removed object is not an editable element');
  }

  edit({
    tracking: {
      actionId: props.tracking?.actionId ?? 'element.removeElement',
      trigger: props.tracking?.trigger,
    },
    description: t('dashboard.edit-actions.remove', 'Remove {{typeName}}', { typeName }),
    removedObject,
    source,
    perform,
    undo,
  });
}
