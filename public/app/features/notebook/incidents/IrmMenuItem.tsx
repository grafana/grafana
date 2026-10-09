import { type ReactElement } from 'react';

import { t } from '@grafana/i18n';
import { Menu, type MenuItemProps } from '@grafana/ui';

import { useNotebookIncidents } from './useNotebookIncidents';

interface Props {
  onDeclare: () => void;
  onAttach: () => void;
}

/**
 * The incident actions, grouped as a dashboard groups them — IRM registers both under
 * `category: 'IRM'`, so the labels and icons are theirs.
 *
 * Both items are built here rather than as components of their own: `Menu.Item` decides it has a
 * submenu from `childItems.length` alone, so a child rendering null would open it on a blank row.
 */
export function IrmMenuItem({ onDeclare, onAttach }: Props) {
  const { AttachToIncidentForm, DeclareIncidentForm } = useNotebookIncidents();

  const childItems: Array<ReactElement<MenuItemProps>> = [];

  if (DeclareIncidentForm) {
    childItems.push(
      <Menu.Item
        key="declare"
        icon="fire"
        label={t('notebooks.incidents.declare', 'Declare incident')}
        onClick={onDeclare}
        testId="notebook-declare-incident"
      />
    );
  }

  if (AttachToIncidentForm) {
    childItems.push(
      <Menu.Item
        key="attach"
        icon="link"
        label={t('notebooks.incidents.attach-title', 'Attach to incident')}
        onClick={onAttach}
        testId="notebook-attach-to-incident"
      />
    );
  }

  if (childItems.length === 0) {
    return null;
  }

  return <Menu.Item label={t('notebooks.incidents.menu', 'IRM')} childItems={childItems} />;
}
