import { RouteChildrenProps } from 'react-router-dom';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { stringifyErrorLike } from '../../utils/misc';
import { TemplateForm } from '../receivers/TemplateForm';

import { useGetNotificationTemplate } from './useNotificationTemplates';

type Props = RouteChildrenProps<{ name: string }>;

const EditMessageTemplate = ({ match }: Props) => {
  const templateName = match?.params.name;

  const { selectedAlertmanager } = useAlertmanager();
  const { currentData, isLoading, error } = useGetNotificationTemplate({
    alertmanager: selectedAlertmanager ?? '',
    name: templateName ?? '',
  });

  if (!templateName) {
    return <EntityNotFound entity="Notification template" />;
  }

  if (isLoading) {
    return <LoadingPlaceholder text="Loading template..." />;
  }

  if (error) {
    return (
      <Alert severity="error" title="Failed to fetch notification template">
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!currentData) {
    return <EntityNotFound entity="Notification template" />;
  }

  const { name, template, provenance } = currentData;
  return (
    <TemplateForm
      alertManagerSourceName={selectedAlertmanager ?? ''}
      // config={config}
      existing={{ name, content: template }}
      provenance={provenance}
    />
  );
};

export default EditMessageTemplate;
