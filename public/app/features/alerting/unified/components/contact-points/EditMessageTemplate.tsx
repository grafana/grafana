import { useParams } from 'react-router-dom-v5-compat';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { isNotFoundError } from '../../api/util';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { stringifyErrorLike } from '../../utils/misc';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { TemplateForm } from '../receivers/TemplateForm';

import { useGetNotificationTemplate } from './useNotificationTemplates';

const notFoundComponent = <EntityNotFound entity="Notification template" />;

const EditMessageTemplateComponent = () => {
  const { name } = useParams<{ name: string }>();
  const templateUid = name ? decodeURIComponent(name) : undefined;

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
    return isNotFoundError(error) ? (
      notFoundComponent
    ) : (
      <Alert severity="error" title="Failed to fetch notification template">
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!currentData) {
    return notFoundComponent;
  }

  return <TemplateForm alertmanager={selectedAlertmanager ?? ''} originalTemplate={currentData} />;
};

function EditMessageTemplate() {
  return (
    <AlertmanagerPageWrapper navId="receivers" accessType="notification">
      <EditMessageTemplateComponent />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(EditMessageTemplate);
