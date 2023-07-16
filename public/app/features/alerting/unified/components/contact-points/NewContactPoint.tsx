import React from 'react';
import { RouteChildrenProps } from 'react-router-dom';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { NewReceiverView } from '../receivers/NewReceiverView';

const NewContactPoint = (_props: RouteChildrenProps) => {
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

  return <NewReceiverView config={data} alertManagerSourceName={selectedAlertmanager!} />;
};

export default NewContactPoint;
