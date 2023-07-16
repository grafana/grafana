import React from 'react';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { GlobalConfigForm } from '../receivers/GlobalConfigForm';

const NewMessageTemplate = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);

  if (isLoading && !data) {
    return 'loading...';
  }

  // TODO decent error handling
  if (error) {
    return String(error);
  }

  if (!data) {
    return null;
  }

  return <GlobalConfigForm config={data} alertManagerSourceName={selectedAlertmanager!} />;
};

export default NewMessageTemplate;
