import React from 'react';
import { RouteChildrenProps } from 'react-router-dom';

import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { useAlertmanagerConfig } from '../../hooks/useAlertmanagerConfig';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { DuplicateTemplateView } from '../receivers/DuplicateTemplateView';

type Props = RouteChildrenProps<{ name: string }>;

const NewMessageTemplate = ({ match }: Props) => {
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

  return <DuplicateTemplateView alertManagerSourceName={selectedAlertmanager!} config={result} templateName={name} />;
};

export default NewMessageTemplate;
