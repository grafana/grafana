import { t } from '@grafana/i18n';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { createRelativeUrl } from '../../utils/url';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { TemplateForm } from '../receivers/TemplateForm';

import { ActiveTab } from './ContactPoints';

function NewMessageTemplatePage() {
  return (
    <AlertmanagerPageWrapper
      navId="receivers"
      accessType="notification"
      pageNav={{
        id: 'templates',
        text: t('alerting.notification-templates.new.title', 'New notification template group'),
        subTitle: t('alerting.notification-templates.new.subTitle', 'Create a new group of notification templates'),
        parentItem: {
          text: t('alerting.common.titles.notification-templates', 'Notification Templates'),
          url: createRelativeUrl('/alerting/notifications', {
            tab: ActiveTab.NotificationTemplates,
          }),
        },
      }}
    >
      <NewMessageTemplate />
    </AlertmanagerPageWrapper>
  );
}

function NewMessageTemplate() {
  const { selectedAlertmanager } = useAlertmanager();
  return <TemplateForm alertmanager={selectedAlertmanager ?? ''} />;
}

export default withPageErrorBoundary(NewMessageTemplatePage);
