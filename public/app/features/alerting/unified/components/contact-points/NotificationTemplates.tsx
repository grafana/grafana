import React from 'react';

import { Alert } from '@grafana/ui';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { TemplatesTable } from '../receivers/TemplatesTable';

export const NotificationTemplates = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { data, error } = useAlertmanagerConfig(selectedAlertmanager);

  if (error) {
    return <Alert title="Failed to fetch notification templates">{String(error)}</Alert>;
  }

  if (data) {
    return <TemplatesTable config={data} alertManagerName={selectedAlertmanager!} />;
  }

  return null;
};
