import { useParams } from 'react-router-dom-v5-compat';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { isNotFoundError } from '../../api/util';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { generateCopiedName } from '../../utils/duplicate';
import { stringifyErrorLike } from '../../utils/misc';
import { updateDefinesWithUniqueValue } from '../../utils/templates';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { TemplateForm } from '../receivers/TemplateForm';

import { useGetNotificationTemplate, useNotificationTemplates } from './useNotificationTemplates';

const notFoundComponent = <EntityNotFound entity="Notification template" />;

const DuplicateMessageTemplateComponent = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { name } = useParams<{ name: string }>();
  const templateUid = name ? decodeURIComponent(name) : undefined;

  const {
    currentData: template,
    isLoading,
    error,
  } = useGetNotificationTemplate({ alertmanager: selectedAlertmanager ?? '', uid: templateUid ?? '' });

  const {
    currentData: templates,
    isLoading: templatesLoading,
    error: templatesError,
  } = useNotificationTemplates({ alertmanager: selectedAlertmanager ?? '' });

  if (!selectedAlertmanager) {
    return <EntityNotFound entity="Alertmanager" />;
  }

  if (!templateUid) {
    return <EntityNotFound entity="Notification template" />;
  }

  if (isLoading || templatesLoading) {
    return <LoadingPlaceholder text="Loading notification template" />;
  }

  if (error || templatesError || !template || !templates) {
    return isNotFoundError(error) ? (
      notFoundComponent
    ) : (
      <Alert title="Error loading notification template" severity="error">
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  const duplicatedName = generateCopiedName(template.title, templates?.map((t) => t.title) ?? []);

  return (
    <TemplateForm
      alertmanager={selectedAlertmanager}
      prefill={{ title: duplicatedName, content: updateDefinesWithUniqueValue(template.content) }}
    />
  );
};

function DuplicateMessageTemplate() {
  return (
    <AlertmanagerPageWrapper navId="receivers" accessType="notification">
      <DuplicateMessageTemplateComponent />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(DuplicateMessageTemplate);
