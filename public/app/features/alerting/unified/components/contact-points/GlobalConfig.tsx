import React from 'react';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { GlobalConfigForm } from '../receivers/GlobalConfigForm';

const NewMessageTemplate = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { result, loading, error } = useAlertmanagerConfig(selectedAlertmanager);

  if (loading && !result) {
    return 'loading...';
  }

  // TODO decent error handling
  if (error) {
    return String(error);
  }

  if (!result) {
    return null;
  }

  return <GlobalConfigForm config={result} alertManagerSourceName={selectedAlertmanager!} />;
};

export default NewMessageTemplate;
