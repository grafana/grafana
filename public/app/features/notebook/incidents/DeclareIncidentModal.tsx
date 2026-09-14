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
 * Not wrapped in a Modal: unlike their attach form, this component brings its own, and wrapping it
 * stacked two dialogs. Their close button still calls the onDismiss passed here.
 *
 * Rendered by the toolbar rather than the menu item that opens it — that item is inside a Dropdown
 * overlay which unmounts as the menu closes, as the delete confirmation is arranged too.
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
