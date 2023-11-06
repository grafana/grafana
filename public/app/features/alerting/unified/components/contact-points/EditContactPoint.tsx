import React from 'react';
import { RouteChildrenProps } from 'react-router-dom';

import { Alert } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { EditReceiverView } from '../receivers/EditReceiverView';

type Props = RouteChildrenProps<{ name: string }>;

const EditContactPoint = ({ match }: Props) => {
  const { selectedAlertmanager } = useAlertmanager();
  const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);

  const contactPointName = match?.params.name;
  if (!contactPointName) {
    return <EntityNotFound entity="Contact point" />;
  }

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

  return (
    <EditReceiverView
      alertManagerSourceName={selectedAlertmanager!}
      config={data}
      receiverName={decodeURIComponent(contactPointName)}
    />
  );
};

export default EditContactPoint;
