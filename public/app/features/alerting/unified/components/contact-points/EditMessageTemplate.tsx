import React from 'react';
import { RouteChildrenProps } from 'react-router-dom';

import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { EditTemplateView } from '../receivers/EditTemplateView';

type Props = RouteChildrenProps<{ name: string }>;

const EditMessageTemplate = ({ match }: Props) => {
  const { selectedAlertmanager } = useAlertmanager();
  const { result, loading, error } = useAlertmanagerConfig(selectedAlertmanager);

  const name = match?.params.name;
  if (!name) {
    return <EntityNotFound entity="Message template" />;
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
    <EditTemplateView
      alertManagerSourceName={selectedAlertmanager!}
      config={result}
      templateName={decodeURIComponent(name)}
    />
  );
};

export default EditMessageTemplate;
