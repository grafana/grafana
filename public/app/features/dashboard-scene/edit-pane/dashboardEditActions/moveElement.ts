import { t } from '@grafana/i18n';

import { getEditableElementFor } from '../shared';

import { edit } from './edit';
import { type MoveElementActionHelperProps } from './types';

/**
 * Moves an element within the dashboard, deriving the undo-stack description from
 * the moved object's editable element type.
 */
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
