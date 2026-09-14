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
 * Hands this notebook to a running incident, using IRM's own form — which does the write itself, so
 * all this supplies is the trigger, the chrome, and the notebook's identity.
 */
export function AttachToIncidentButton({ uid, title }: Props) {
  const { pluginId, AttachToIncidentForm } = useNotebookIncidents();
  const [isAttaching, setIsAttaching] = useState(false);

  if (!AttachToIncidentForm) {
    return null;
  }

  // Their form raises its own toast, which has no link and cannot be suppressed from here.
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
            defaultCaption={t('notebooks.incidents.caption', 'Notebook: {{title}}', { title })}
            onAttach={onAttach}
            onDismiss={() => setIsAttaching(false)}
          />
        </Modal>
      )}
    </>
  );
}
