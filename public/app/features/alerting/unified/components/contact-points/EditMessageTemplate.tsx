import React from 'react';
import { RouteChildrenProps } from 'react-router-dom';

import { Alert } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { EditTemplateView } from '../receivers/EditTemplateView';

type Props = RouteChildrenProps<{ name: string }>;

const EditMessageTemplate = ({ match }: Props) => {
  const { selectedAlertmanager } = useAlertmanager();
  const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);

  const name = match?.params.name;
  if (!name) {
    return <EntityNotFound entity="Message template" />;
  }

  if (isLoading && !data) {
    return 'loading...';
  }

  if (error) {
    return (
      <Alert severity="error" title="Failed to fetch message template">
        {String(error)}
      </Alert>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <EditTemplateView
      alertManagerSourceName={selectedAlertmanager!}
      config={data}
      templateName={decodeURIComponent(name)}
    />
  );
};

export default EditMessageTemplate;
