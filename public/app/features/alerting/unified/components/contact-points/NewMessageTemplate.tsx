import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { useTemplatesNav } from '../../navigation/useTemplatesNav';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { createRelativeUrl } from '../../utils/url';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { TemplateForm } from '../receivers/TemplateForm';

import { ActiveTab } from './ContactPoints';

function NewMessageTemplatePage() {
  const { navId } = useTemplatesNav();
  const useV2Nav = config.featureToggles.alertingNavigationV2;

  // For V2 nav, the parent URL points to the dedicated Templates tab
  // For legacy nav, Templates is accessed via the Contact Points page with tab parameter
  const parentUrl = useV2Nav
    ? '/alerting/notifications/templates'
    : createRelativeUrl('/alerting/notifications', { tab: ActiveTab.NotificationTemplates });

  return (
    <AlertmanagerPageWrapper
      navId={navId}
      accessType="notification"
      pageNav={{
        id: 'templates',
        text: t('alerting.notification-templates.new.title', 'New notification template group'),
        subTitle: t('alerting.notification-templates.new.subTitle', 'Create a new group of notification templates'),
        parentItem: {
          text: t('alerting.common.titles.notification-templates', 'Notification Templates'),
          url: parentUrl,
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
