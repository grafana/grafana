import React from 'react';

import { Alert } from '@grafana/ui';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { NewReceiverView } from '../receivers/NewReceiverView';

const NewContactPoint = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);

  if (isLoading && !data) {
    return 'loading...';
  }

  if (error) {
    return (
      <Alert severity="error" title="Failed to fetch contact point">
        {String(error)}
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  return <NewReceiverView config={data} alertManagerSourceName={selectedAlertmanager!} />;
};

export default NewContactPoint;
