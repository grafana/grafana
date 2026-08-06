/* eslint-disable @grafana/i18n/no-translation-top-level */
import { t } from '@grafana/i18n';

import { edit } from '../utils/edit';
import { getEditableElementFor } from '../utils/getEditableElementFor';
import { type AddElementActionHelperProps } from '../utils/types';

/**
 * Helper for edit that adds elements
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
