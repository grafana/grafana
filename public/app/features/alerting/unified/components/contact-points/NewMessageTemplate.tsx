import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';

import { useTemplatesNav } from '../../navigation/useNotificationConfigNav';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { getTemplateParentUrl } from '../../utils/navigation';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { TemplateForm } from '../receivers/TemplateForm';

function NewMessageTemplatePage() {
  const { navId } = useTemplatesNav();
  const useV2Nav = config.featureToggles.alertingNavigationV2;
  const parentUrl = getTemplateParentUrl(useV2Nav);

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
