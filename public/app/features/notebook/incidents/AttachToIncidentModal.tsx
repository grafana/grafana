import { useState } from 'react';

import { AppEvents, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, LinkButton, Modal, RadioButtonList, Spinner, Stack, Text } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { incidentsApi } from 'app/features/alerting/unified/api/incidentsApi';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';

import { notebookShareUrl } from '../urls';

import { DECLARE_INCIDENT_PATH } from './useNotebookIncidents';

interface Props {
  uid: string;
  title: string;
  pluginId: string;
  onDismiss: () => void;
}

/**
 * The note posted onto the incident. The URL is the point of it: the Incident API has no attachment
 * method, so a link in an activity body is how context gets attached — the backend parses it out.
 */
export function attachedNotebookNote(title: string, url: string): string {
  return `Notebook: ${title}\n${url}`;
}

/**
 * Picks which running incident this notebook belongs to.
 *
 * Active incidents only, which is what the shared query already asks for — a resolved incident is
 * not something you attach an in-progress investigation to.
 */
export function AttachToIncidentModal({ uid, title, pluginId, onDismiss }: Props) {
  const { data, isLoading, isError } = incidentsApi.useGetActiveIncidentsQuery({ pluginId });
  const [attach, { isLoading: isAttaching }] = incidentsApi.useAddIncidentActivityMutation();
  // '' rather than undefined: RadioButtonList would otherwise start out uncontrolled and become
  // controlled on the first pick, which React warns about. No incident has an empty id, so this
  // matches nothing and the confirm stays unavailable until something is chosen.
  const [selected, setSelected] = useState('');

  const incidents = data?.incidents ?? [];
  const options: Array<SelectableValue<string>> = incidents.map((incident) => ({
    label: incident.title,
    value: incident.incidentID,
    description: incident.severityLabel,
  }));

  const onAttach = async () => {
    const incident = incidents.find(({ incidentID }) => incidentID === selected);
    if (!incident) {
      return;
    }

    try {
      await attach({
        pluginId,
        incidentID: incident.incidentID,
        body: attachedNotebookNote(title, notebookShareUrl(uid)),
      }).unwrap();
    } catch {
      // The mutation reports the failure itself, and the modal stays open on the same selection so
      // it can be retried without picking again.
      return;
    }

    appEvents.emit(AppEvents.alertSuccess, [
      t('notebooks.incidents.attached', 'Notebook attached to "{{incident}}"', { incident: incident.title }),
    ]);
    onDismiss();
  };

  return (
    <Modal isOpen title={t('notebooks.incidents.attach-title', 'Attach to incident')} onDismiss={onDismiss}>
      {isLoading && <Spinner />}

      {isError && (
        <Alert
          severity="error"
          title={t('notebooks.incidents.load-failed', 'Could not load incidents')}
          // Nothing to retry against here beyond reopening: the query refetches on mount.
        >
          <Trans i18nKey="notebooks.incidents.load-failed-body">
            Check that you have access to Incident, then try again.
          </Trans>
        </Alert>
      )}

      {!isLoading && !isError && options.length === 0 && (
        <Stack direction="column" gap={2} alignItems="flex-start">
          <Text color="secondary">
            <Trans i18nKey="notebooks.incidents.none-active">
              There are no active incidents to attach this notebook to.
            </Trans>
          </Text>
          <LinkButton
            variant="secondary"
            icon="fire"
            href={createBridgeURL(pluginId, DECLARE_INCIDENT_PATH, { title, url: notebookShareUrl(uid) })}
          >
            <Trans i18nKey="notebooks.incidents.declare">Declare incident</Trans>
          </LinkButton>
        </Stack>
      )}

      {options.length > 0 && (
        // fieldset/legend rather than a Field: a radio group is named by its legend, and Field's
        // htmlFor would point at the group's wrapper rather than at any one input.
        <fieldset>
          <legend>
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="notebooks.incidents.active">Active incidents</Trans>
            </Text>
          </legend>
          <RadioButtonList
            name="notebook-attach-incident"
            options={options}
            value={selected}
            onChange={setSelected}
            disabled={isAttaching}
          />
        </fieldset>
      )}

      {options.length > 0 && (
        <Modal.ButtonRow>
          <Button variant="secondary" fill="outline" onClick={onDismiss} disabled={isAttaching}>
            <Trans i18nKey="notebooks.incidents.cancel">Cancel</Trans>
          </Button>
          {/* Nothing is selected on open, so the confirm has to start out unavailable. */}
          <Button onClick={onAttach} disabled={!selected || isAttaching}>
            {isAttaching
              ? t('notebooks.incidents.attaching', 'Attaching...')
              : t('notebooks.incidents.attach', 'Attach')}
          </Button>
        </Modal.ButtonRow>
      )}
    </Modal>
  );
}
