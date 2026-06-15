import { t } from '@grafana/i18n';

import { getEditableElementFor } from '../shared';

import { edit } from './edit';
import { type AddElementActionHelperProps } from './types';

/**
 * Adds an element to the dashboard, deriving the undo-stack description from the
 * added object's editable element type.
 */
export function addElement(props: AddElementActionHelperProps) {
  const { addedObject, source, perform, undo } = props;

  const element = getEditableElementFor(addedObject);
  if (!element) {
    throw new Error('Added object is not an editable element');
  }

  const typeName = element.getEditableElementInfo().typeName;

  edit({
    description: t('dashboard.edit-actions.add', 'Add {{typeName}}', { typeName }),
    addedObject,
    source,
    perform,
    undo,
  });
}
