import React from 'react';

import { Alert } from '@grafana/ui';

import { useAlertmanagerConfig } from '../../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../../state/AlertmanagerContext';
import { GlobalConfigForm } from '../../receivers/GlobalConfigForm';

const NewMessageTemplate = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);

  if (isLoading && !data) {
    return 'loading...';
  }

  if (error) {
    return (
      <Alert severity="error" title="Failed to fetch notification template">
        {String(error)}
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  return <GlobalConfigForm config={data} alertManagerSourceName={selectedAlertmanager!} />;
};

export default NewMessageTemplate;
