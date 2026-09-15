import { type ReactElement } from 'react';

import { t } from '@grafana/i18n';
import { Menu, type MenuItemProps } from '@grafana/ui';

import { useNotebookIncidents } from './useNotebookIncidents';

interface Props {
  onDeclare: () => void;
  onAttach: () => void;
}

/**
 * The incident actions, grouped the way a dashboard groups them.
 *
 * IRM registers both of these into the panel menu under `category: 'IRM'`, which the dashboard turns
 * into a submenu — same labels, same icons, so the two surfaces file the same actions alike.
 *
 * Both items are built here rather than as components of their own, because `Menu.Item` decides it
 * has a submenu from `childItems.length` alone: a child that rendered null on a stack exposing only
 * one of the two would still open the submenu, on a blank row.
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
