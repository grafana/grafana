import { t, Trans } from '@grafana/i18n';
import { Modal, TextLink } from '@grafana/ui';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { dispatch } from 'app/store/store';

import { notebookShareUrl } from '../urls';

import { type AttachToIncidentFormData, useNotebookIncidents } from './useNotebookIncidents';

interface Props {
  uid: string;
  title: string;
  onDismiss: () => void;
}

/**
 * Hands this notebook to a running incident, using IRM's own form — which does the write itself, so
 * all this supplies is the chrome and the notebook's identity.
 *
 * Wrapped in a Modal, unlike DeclareIncidentModal beside it: their attach form is a bare form, and
 * IRM's own dashboard entry point wraps it the same way.
 *
 * Rendered by the toolbar rather than the submenu item that opens it — that item is inside a
 * Dropdown overlay which unmounts as the menu closes.
 */
export function AttachToIncidentModal({ uid, title, onDismiss }: Props) {
  const { pluginId, AttachToIncidentForm } = useNotebookIncidents();

  if (!AttachToIncidentForm) {
    return null;
  }

  // Their form raises its own toast, which has no link and cannot be suppressed from here.
  const onAttach = (data: AttachToIncidentFormData) => {
    // Belt and braces: their form calls onDismiss straight after this, but the props here are
    // transcribed by hand, so nothing checks that it still does.
    onDismiss();

    const incident = data.selectedIncident?.incident;
    if (!incident) {
      return;
    }

    const incidentTitle = incident.title?.trim();

    dispatch(
      notifyApp(
        createSuccessNotification(
          incidentTitle
            ? t('notebooks.incidents.attached', 'Notebook attached to "{{incident}}"', {
                incident: incidentTitle,
                // Rendered as plain text, so an escaped apostrophe would show as `&#39;`.
                interpolation: { escapeValue: false },
              })
            : t('notebooks.incidents.attached-untitled', 'Notebook attached to the incident'),
          '',
          undefined,
          <TextLink href={createBridgeURL(pluginId, `/incidents/${incident.incidentID}`)}>
            <Trans i18nKey="notebooks.incidents.view-incident">View incident</Trans>
          </TextLink>
        )
      )
    );
  };

  return (
    <Modal isOpen title={t('notebooks.incidents.attach-title', 'Attach to incident')} onDismiss={onDismiss}>
      <AttachToIncidentForm
        attachURL={notebookShareUrl(uid)}
        defaultCaption={t('notebooks.incidents.caption', 'Notebook: {{title}}', {
          title,
          // This is data, not display: IRM stores it as the attachment's label. Escaped, a
          // notebook called `errors/sec` would be filed as `errors&#x2F;sec`.
          interpolation: { escapeValue: false },
        })}
        onAttach={onAttach}
        onDismiss={onDismiss}
      />
    </Modal>
  );
}
