import React from 'react';
import { RouteChildrenProps } from 'react-router-dom';

import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { EditReceiverView } from '../receivers/EditReceiverView';

type Props = RouteChildrenProps<{ name: string }>;

const EditContactPoint = ({ match }: Props) => {
  const { selectedAlertmanager } = useAlertmanager();
  const { result, loading, error } = useAlertmanagerConfig(selectedAlertmanager);

  const contactPointName = match?.params.name;
  if (!contactPointName) {
    return <EntityNotFound entity="Contact point" />;
  }

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

  return (
    <EditReceiverView
      alertManagerSourceName={selectedAlertmanager!}
      config={result}
      receiverName={decodeURIComponent(contactPointName)}
    />
  );
};

export default EditContactPoint;
