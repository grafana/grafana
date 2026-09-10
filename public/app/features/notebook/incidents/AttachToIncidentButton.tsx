import { useState } from 'react';

import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { AttachToIncidentModal } from './AttachToIncidentModal';
import { useNotebookIncidents } from './useNotebookIncidents';

interface Props {
  uid: string;
  title: string;
}

/**
 * Hands this notebook to an incident that is already running.
 *
 * Owns the modal rather than letting the toolbar hold it: unlike the delete confirmation, nothing
 * here lives inside a Dropdown overlay that would unmount it as a menu closes.
 */
export function AttachToIncidentButton({ uid, title }: Props) {
  const { pluginId, available } = useNotebookIncidents();
  const [isPicking, setIsPicking] = useState(false);

  if (!available) {
    return null;
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon="fire"
        onClick={() => setIsPicking(true)}
        tooltip={t('notebooks.incidents.attach-tooltip', 'Attach this notebook to an incident as context')}
        data-testid="notebook-attach-to-incident"
      >
        {t('notebooks.incidents.attach-title', 'Attach to incident')}
      </Button>
      {isPicking && (
        <AttachToIncidentModal uid={uid} title={title} pluginId={pluginId} onDismiss={() => setIsPicking(false)} />
      )}
    </>
  );
}
