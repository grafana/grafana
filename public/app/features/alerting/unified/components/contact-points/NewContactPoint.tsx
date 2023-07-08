import React from 'react';
import { RouteChildrenProps } from 'react-router-dom';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { NewReceiverView } from '../receivers/NewReceiverView';

const NewContactPoint = (_props: RouteChildrenProps) => {
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

  return <NewReceiverView config={result} alertManagerSourceName={selectedAlertmanager!} />;
};

export default NewContactPoint;
