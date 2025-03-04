import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { stringifyErrorLike } from '../../utils/misc';
import { TemplatesTable } from '../receivers/TemplatesTable';

import { useNotificationTemplates } from './useNotificationTemplates';

export const NotificationTemplates = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { data: templates, isLoading, error } = useNotificationTemplates({ alertmanager: selectedAlertmanager ?? '' });

  if (error) {
    return (
      <Alert
        title={t(
          'alerting.notification-templates.title-failed-to-fetch-notification-templates',
          'Failed to fetch notification templates'
        )}
      >
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <LoadingPlaceholder
        text={t(
          'alerting.notification-templates.text-loading-notification-templates',
          'Loading notification templates'
        )}
      />
    );
  }

  if (templates) {
    return <TemplatesTable alertManagerName={selectedAlertmanager!} templates={templates} />;
  }

  return null;
};
