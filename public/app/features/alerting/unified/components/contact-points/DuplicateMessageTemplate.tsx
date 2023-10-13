import React from 'react';
import { RouteChildrenProps } from 'react-router-dom';

import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { DuplicateTemplateView } from '../receivers/DuplicateTemplateView';

type Props = RouteChildrenProps<{ name: string }>;

const NewMessageTemplate = ({ match }: Props) => {
  const { selectedAlertmanager } = useAlertmanager();
  const { data, isLoading, error } = useAlertmanagerConfig(selectedAlertmanager);

  const name = match?.params.name;
  if (!name) {
    return <EntityNotFound entity="Message template" />;
  }

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

  return <DuplicateTemplateView alertManagerSourceName={selectedAlertmanager!} config={data} templateName={name} />;
};

export default NewMessageTemplate;
