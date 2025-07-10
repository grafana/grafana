import { useParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { isNotFoundError } from '../../api/util';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { stringifyErrorLike } from '../../utils/misc';
import { createRelativeUrl } from '../../utils/url';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { TemplateForm } from '../receivers/TemplateForm';

import { ActiveTab } from './ContactPoints';
import { useGetNotificationTemplate } from './useNotificationTemplates';

const notFoundComponent = <EntityNotFound entity="Notification template" />;

const EditMessageTemplateComponent = () => {
  const { name } = useParams<{ name: string }>();
  const templateUid = name ? decodeURIComponent(name) : undefined;

  const { selectedAlertmanager } = useAlertmanager();
  const { currentData, isLoading, error, isUninitialized } = useGetNotificationTemplate({
    alertmanager: selectedAlertmanager ?? '',
    uid: templateUid ?? '',
  });

  if (!templateUid) {
    return <EntityNotFound entity="Notification template" />;
  }

  if (isLoading || isUninitialized) {
    return (
      <LoadingPlaceholder text={t('alerting.edit-message-template.text-loading-template', 'Loading template...')} />
    );
  }

  if (error) {
    return isNotFoundError(error) ? (
      notFoundComponent
    ) : (
      <Alert
        severity="error"
        title={t(
          'alerting.edit-message-template.title-failed-to-fetch-notification-template',
          'Failed to fetch notification template'
        )}
      >
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
    <AlertmanagerPageWrapper
      navId="receivers"
      accessType="notification"
      pageNav={{
        id: 'templates',
        text: t('alerting.notification-templates.edit.title', 'Edit notification template group'),
        subTitle: t('alerting.notification-templates.edit.subTitle', 'Edit a group of notification templates'),
        parentItem: {
          text: t('alerting.common.titles.notification-templates', 'Notification Templates'),
          url: createRelativeUrl('/alerting/notifications', {
            tab: ActiveTab.NotificationTemplates,
          }),
        },
      }}
    >
      <EditMessageTemplateComponent />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(EditMessageTemplate);
