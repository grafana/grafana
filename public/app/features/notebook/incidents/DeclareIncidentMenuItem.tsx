import { t } from '@grafana/i18n';
import { Menu } from '@grafana/ui';

import { useNotebookIncidents } from './useNotebookIncidents';

interface Props {
  /** Raises the modal, which the toolbar owns — see DeclareIncidentModal. */
  onSelect: () => void;
}

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
