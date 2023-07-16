import React from 'react';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { NewTemplateView } from '../receivers/NewTemplateView';

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

  return <NewTemplateView alertManagerSourceName={selectedAlertmanager!} config={data} />;
};

export default NewMessageTemplate;
