import { Route, Routes } from 'react-router-dom-v5-compat';

import { Trans } from '@grafana/i18n';
import { LinkButton, Stack, Text } from '@grafana/ui';

import { AlertmanagerPageWrapper } from './components/AlertingPageWrapper';
import DuplicateMessageTemplate from './components/contact-points/DuplicateMessageTemplate';
import EditMessageTemplate from './components/contact-points/EditMessageTemplate';
import NewMessageTemplate from './components/contact-points/NewMessageTemplate';
import { NotificationTemplates } from './components/contact-points/NotificationTemplates';
import { AlertmanagerAction, useAlertmanagerAbility } from './hooks/useAbilities';
import { useNotificationConfigNav } from './navigation/useNotificationConfigNav';
import { withPageErrorBoundary } from './withPageErrorBoundary';

const TemplatesList = () => {
  const [createTemplateSupported, createTemplateAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.CreateNotificationTemplate
  );

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Text variant="body" color="secondary">
          <Trans i18nKey="alerting.notification-templates-tab.create-notification-templates-customize-notifications">
            Create notification templates to customize your notifications.
          </Trans>
        </Text>
        {createTemplateSupported && (
          <LinkButton
            icon="plus"
            variant="primary"
            href="/alerting/notifications/templates/new"
            disabled={!createTemplateAllowed}
          >
            <Trans i18nKey="alerting.notification-templates-tab.add-notification-template-group">
              Add notification template group
            </Trans>
          </LinkButton>
        )}
      </Stack>
      <NotificationTemplates />
    </>
  );
};

function NotificationTemplatesRoutes() {
  return (
    <Routes>
      <Route path="" element={<TemplatesList />} />
      <Route path="new" element={<NewMessageTemplate />} />
      <Route path=":name/edit" element={<EditMessageTemplate />} />
      <Route path=":name/duplicate" element={<DuplicateMessageTemplate />} />
    </Routes>
  );
}

function NotificationTemplatesPage() {
  const { navId, pageNav } = useNotificationConfigNav();

  return (
    <AlertmanagerPageWrapper navId={navId || 'receivers'} pageNav={pageNav} accessType="notification">
      <NotificationTemplatesRoutes />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(NotificationTemplatesPage);
