import { Trans } from '@grafana/i18n';
import { LinkButton, Stack, Text } from '@grafana/ui';

import { AlertmanagerAction } from '../../hooks/useAbilities.types';
import { useAlertmanagerAbilityState } from '../../hooks/useAlertmanagerAbilities';
import { useTemplatesNav } from '../../navigation/useNotificationConfigNav';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { GrafanaAlertmanagerWarning } from '../GrafanaAlertmanagerWarning';

import { NotificationTemplates } from './NotificationTemplates';

function TemplatesPageContent() {
  const { supported: createTemplateSupported, allowed: createTemplateAllowed } = useAlertmanagerAbilityState(
    AlertmanagerAction.CreateNotificationTemplate
  );

  return (
    <Stack direction="column" gap={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Text variant="body" color="secondary">
          <Trans i18nKey="alerting.templates-page.description">
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
            <Trans i18nKey="alerting.templates-page.add-template">New notification template</Trans>
          </LinkButton>
        )}
      </Stack>
      <NotificationTemplates />
    </Stack>
  );
}

function TemplatesPage() {
  const { navId, pageNav } = useTemplatesNav();

  return (
    <AlertmanagerPageWrapper navId={navId} pageNav={pageNav} accessType="notification">
      <GrafanaAlertmanagerWarning currentAlertmanager="grafana" />
      <TemplatesPageContent />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(TemplatesPage);
