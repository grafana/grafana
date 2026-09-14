import { t } from '@grafana/i18n';

import { notebookShareUrl } from '../urls';

import { useNotebookIncidents } from './useNotebookIncidents';

interface Props {
  uid: string;
  title: string;
  onDismiss: () => void;
}

export function DeclareIncidentModal({ uid, title, onDismiss }: Props) {
  const { DeclareIncidentForm } = useNotebookIncidents();

  if (!DeclareIncidentForm) {
    return null;
  }

  return (
    <DeclareIncidentForm
      defaultTitle={title}
      attachURL={notebookShareUrl(uid)}
      attachCaption={t('notebooks.incidents.caption', 'Notebook: {{title}}', {
        title,
        // Stored by IRM as the attachment's label, so it must not be HTML-escaped.
        interpolation: { escapeValue: false },
      })}
      onDismiss={onDismiss}
    />
  );
}
