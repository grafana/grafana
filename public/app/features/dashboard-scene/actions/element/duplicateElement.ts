import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { edit } from '../utils/edit';
import { getElementTypeName } from '../utils/getElementTypeName';

interface DuplicateElementActionHelperProps<T extends SceneObject = SceneObject> {
  duplicatedObject: T;
  source: SceneObject;
  /** Extra state applied to the clone, e.g. a renamed title. A fresh key is always generated. */
  cloneState?: Partial<T['state']>;
  perform: (duplicate: T) => void;
  undo: (duplicate: T) => void;
}

/**
 * Helper for edit that duplicates elements.
 * Clones the duplicated object (with a fresh key) and passes the clone to perform/undo.
 */
export function duplicateElement<T extends SceneObject>(props: DuplicateElementActionHelperProps<T>) {
  const { duplicatedObject, source, cloneState, perform, undo } = props;

  const typeName = getElementTypeName(duplicatedObject);
  if (!typeName) {
    throw new Error('Duplicated object is not an editable element');
  }

  const addedObject = duplicatedObject.clone({ ...cloneState, key: undefined });

  edit({
    description: t('dashboard.edit-actions.duplicate', 'Duplicate {{typeName}}', { typeName }),
    addedObject,
    source,
    perform: () => perform(addedObject),
    undo: () => undo(addedObject),
  });
}
