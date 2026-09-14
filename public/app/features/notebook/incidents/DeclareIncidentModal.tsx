import { t } from '@grafana/i18n';
import { Modal } from '@grafana/ui';

import { notebookShareUrl } from '../urls';

import { useNotebookIncidents } from './useNotebookIncidents';

interface Props {
  uid: string;
  title: string;
  onDismiss: () => void;
}

/**
 * IRM's declare form, over the notebook that prompted it.
 *
 * Rendered by the toolbar rather than by the menu item that opens it: that item lives inside a
 * Dropdown overlay, which unmounts as the menu closes and would take this with it. The delete
 * confirmation is arranged the same way and for the same reason.
 *
 * The notebook goes in as attached context, so the incident links back here from the moment it is
 * declared — and attachCaption labels it, which is the difference between the attachment reading
 * "Notebook: Q2 latency" and reading "Grafana".
 */
export function DeclareIncidentModal({ uid, title, onDismiss }: Props) {
  const { DeclareIncidentForm } = useNotebookIncidents();

  if (!DeclareIncidentForm) {
    return null;
  }

  return (
    <Modal isOpen title={t('notebooks.incidents.declare', 'Declare incident')} onDismiss={onDismiss}>
      <DeclareIncidentForm
        defaultTitle={title}
        attachURL={notebookShareUrl(uid)}
        attachCaption={t('notebooks.incidents.caption', 'Notebook: {{title}}', { title })}
        onDismiss={onDismiss}
      />
    </Modal>
  );
}
