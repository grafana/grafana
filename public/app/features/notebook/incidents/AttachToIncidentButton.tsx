import { useState } from 'react';

import { t, Trans } from '@grafana/i18n';
import { Button, Modal, TextLink } from '@grafana/ui';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { notifyApp } from 'app/core/reducers/appNotification';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { dispatch } from 'app/store/store';

import { notebookShareUrl } from '../urls';

import { type AttachToIncidentFormData, useNotebookIncidents } from './useNotebookIncidents';

interface Props {
  uid: string;
  title: string;
}

/**
 * Hands this notebook to an incident that is already running, using IRM's own form.
 *
 * Their form does the write itself — AddIncidentContext with the caption as the attachment's title —
 * so there is nothing here but the trigger, the modal around it, and the notebook's identity going
 * in. Rebuilding the picker gave a worse result: without a caption IRM falls back to unfurling the
 * URL, which reads "Grafana" because core serves one static page title for every route.
 */
export function AttachToIncidentButton({ uid, title }: Props) {
  const { pluginId, AttachToIncidentForm } = useNotebookIncidents();
  const [isAttaching, setIsAttaching] = useState(false);

  if (!AttachToIncidentForm) {
    return null;
  }

  // Their form raises its own success toast, which cannot be suppressed from here and carries no
  // link. This adds the one thing it is missing rather than replacing it.
  const onAttach = (data: AttachToIncidentFormData) => {
    const incident = data.selectedIncident?.incident;
    if (!incident) {
      return;
    }

    dispatch(
      notifyApp(
        createSuccessNotification(
          t('notebooks.incidents.attached', 'Notebook attached to "{{incident}}"', { incident: incident.title ?? '' }),
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
    <>
      <Button
        variant="secondary"
        size="sm"
        icon="fire"
        onClick={() => setIsAttaching(true)}
        tooltip={t('notebooks.incidents.attach-tooltip', 'Attach this notebook to an incident as context')}
        data-testid="notebook-attach-to-incident"
      >
        {t('notebooks.incidents.attach-title', 'Attach to incident')}
      </Button>
      {isAttaching && (
        <Modal
          isOpen
          title={t('notebooks.incidents.attach-title', 'Attach to incident')}
          onDismiss={() => setIsAttaching(false)}
        >
          <AttachToIncidentForm
            attachURL={notebookShareUrl(uid)}
            // Prefilled rather than left blank: this is the attachment's label, and a notebook's
            // title is the best guess at what someone would have typed.
            defaultCaption={t('notebooks.incidents.caption', 'Notebook: {{title}}', { title })}
            onAttach={onAttach}
            onDismiss={() => setIsAttaching(false)}
          />
        </Modal>
      )}
    </>
  );
}
