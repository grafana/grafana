import { t } from '@grafana/i18n';

import { edit } from '../utils/edit';
import { getEditableElementFor } from '../utils/getEditableElementFor';
import { type RemoveElementActionHelperProps } from '../utils/types';

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
