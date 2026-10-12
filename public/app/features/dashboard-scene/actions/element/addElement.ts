import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { type DashboardActionMeta } from '../../sidebar/events';
import { edit } from '../utils/edit';
import { getElementTypeName } from '../utils/getElementTypeName';

interface AddElementActionHelperProps {
  meta: DashboardActionMeta;
  addedObject: SceneObject;
  source: SceneObject;
  perform: () => void;
  undo: () => void;
}

/**
 * Helper for edit that adds elements
 */
export function addElement(props: AddElementActionHelperProps) {
  const { addedObject, source, perform, undo } = props;

  const typeName = getElementTypeName(addedObject);
  if (typeName === undefined) {
    throw new Error('Added object is not an editable element');
  }

  edit({
    meta: props.meta,
    description: t('dashboard.edit-actions.add', 'Add {{typeName}}', { typeName }),
    addedObject,
    source,
    perform,
    undo,
  });
}
