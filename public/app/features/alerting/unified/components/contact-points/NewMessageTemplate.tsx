import React from 'react';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { NewTemplateView } from '../receivers/NewTemplateView';

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

  return <NewTemplateView alertManagerSourceName={selectedAlertmanager!} config={result} />;
};

export default NewMessageTemplate;
