import { t } from '@grafana/i18n';

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
 * Deliberately NOT wrapped in a Modal, unlike the attach form beside it: IRM's two exposed
 * components are not alike. Their attach form is a bare form whose host supplies the chrome, but
 * their declare component renders a complete Modal of its own — with a title that becomes "Start a
 * drill" in drill mode, and closeOnBackdropClick off. Wrapping it produced two stacked dialogs.
 *
 * Their own close button reaches us: their handleDismiss strips the declare query params it reads
 * and then calls this onDismiss, so the toolbar's state is cleared either way.
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
    <DeclareIncidentForm
      defaultTitle={title}
      attachURL={notebookShareUrl(uid)}
      attachCaption={t('notebooks.incidents.caption', 'Notebook: {{title}}', { title })}
      onDismiss={onDismiss}
    />
  );
}
