import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { edit } from '../utils/edit';
import { getEditableElementFor } from '../utils/getEditableElementFor';
import { type DuplicateElementActionHelperProps } from '../utils/types';

/**
 * Helper for edit that duplicates elements.
 * Clones the duplicated object (with a fresh key) and passes the clone to perform/undo.
 */
export function duplicateElement<T extends SceneObject>(props: DuplicateElementActionHelperProps<T>) {
  const { duplicatedObject, source, cloneState, perform, undo } = props;

  const element = getEditableElementFor(duplicatedObject);
  if (!element) {
    throw new Error('Duplicated object is not an editable element');
  }

  const typeName = element.getEditableElementInfo().typeName;
  const addedObject = duplicatedObject.clone({ ...cloneState, key: undefined });

  edit({
    description: t('dashboard.edit-actions.duplicate', 'Duplicate {{typeName}}', { typeName }),
    addedObject,
    source,
    perform: () => perform(addedObject),
    undo: () => undo(addedObject),
  });
}
