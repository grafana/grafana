import { RouteChildrenProps } from 'react-router-dom';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { stringifyErrorLike } from '../../utils/misc';
import { TemplateForm } from '../receivers/TemplateForm';

import { useGetNotificationTemplate } from './useNotificationTemplates';

type Props = RouteChildrenProps<{ name: string }>;

const EditMessageTemplate = ({ match }: Props) => {
  const templateUid = match?.params.name ? decodeURIComponent(match?.params.name) : undefined;

  const { selectedAlertmanager } = useAlertmanager();
  const { currentData, isLoading, error } = useGetNotificationTemplate({
    alertmanager: selectedAlertmanager ?? '',
    uid: templateUid ?? '',
  });

  if (!templateUid) {
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

  return <TemplateForm alertManagerSourceName={selectedAlertmanager ?? ''} originalTemplate={currentData} />;
};

export default EditMessageTemplate;
