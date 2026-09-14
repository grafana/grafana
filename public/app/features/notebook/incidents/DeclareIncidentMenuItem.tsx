import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';

import { useNotebookIncidents } from './useNotebookIncidents';

interface Props {
  /** Raises the modal, which the toolbar owns — see DeclareIncidentModal. */
  onSelect: () => void;
}

/**
 * Opens IRM's declare form over the notebook, rather than navigating to their page.
 *
 * Renders nothing when IRM is absent. Deliberately not the shared DeclareIncidentMenuItem from
 * alerting, which renders a disabled item with a tooltip in that case — right in an alert rule menu,
 * wrong as a permanently dead entry in every notebook menu on a stack without IRM.
 */
export function DeclareIncidentMenuItem({ onSelect }: Props) {
  const { DeclareIncidentForm } = useNotebookIncidents();

  if (!DeclareIncidentForm) {
    return null;
  }

  return (
    <Menu.Item
      icon="fire"
      label={t('notebooks.incidents.declare', 'Declare incident')}
      onClick={onSelect}
      testId="notebook-declare-incident"
    />
  );
}
