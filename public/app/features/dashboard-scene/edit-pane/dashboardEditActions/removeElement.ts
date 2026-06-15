import { t } from '@grafana/i18n';

import { getEditableElementFor } from '../shared';

import { edit } from './edit';
import { type RemoveElementActionHelperProps } from './types';

/**
 * Removes an element from the dashboard, deriving the undo-stack description from
 * the removed object's editable element type.
 */
export function removeElement(props: RemoveElementActionHelperProps) {
  const { removedObject, source, perform, undo } = props;

  const element = getEditableElementFor(removedObject);
  if (!element) {
    throw new Error('Removed object is not an editable element');
  }

  const typeName = element.getEditableElementInfo().typeName;

  edit({
    description: t('dashboard.edit-actions.remove', 'Remove {{typeName}}', { typeName }),
    removedObject,
    source,
    perform,
    undo,
  });
}
