import { useParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { isNotFoundError } from '../../api/util';
import { useTemplatesNav } from '../../navigation/useTemplatesNav';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { generateCopiedName } from '../../utils/duplicate';
import { stringifyErrorLike } from '../../utils/misc';
import { updateDefinesWithUniqueValue } from '../../utils/templates';
import { createRelativeUrl } from '../../utils/url';
import { withPageErrorBoundary } from '../../withPageErrorBoundary';
import { AlertmanagerPageWrapper } from '../AlertingPageWrapper';
import { TemplateForm } from '../receivers/TemplateForm';

import { ActiveTab } from './ContactPoints';
import { useGetNotificationTemplate, useNotificationTemplates } from './useNotificationTemplates';

const notFoundComponent = <EntityNotFound entity="Notification template" />;

const DuplicateMessageTemplateComponent = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { name } = useParams<{ name: string }>();
  const templateUid = name ? decodeURIComponent(name) : undefined;

  const {
    currentData: template,
    isLoading: isLoadingTemplate,
    error: templateFetchError,
  } = useGetNotificationTemplate({ alertmanager: selectedAlertmanager ?? '', uid: templateUid ?? '' });

  const {
    currentData: templates,
    isLoading: templatesLoading,
    error: templatesFetchError,
  } = useNotificationTemplates({ alertmanager: selectedAlertmanager ?? '' });

  const isLoading = isLoadingTemplate || templatesLoading;
  const error = templateFetchError || templatesFetchError;

  if (!selectedAlertmanager) {
    return <EntityNotFound entity="Alertmanager" />;
  }

  if (!templateUid) {
    return <EntityNotFound entity="Notification template" />;
  }

  if (isLoading) {
    return (
      <LoadingPlaceholder
        text={t(
          'alerting.duplicate-message-template.text-loading-notification-template',
          'Loading notification template'
        )}
      />
    );
  }

  if (error) {
    return isNotFoundError(error) ? (
      notFoundComponent
    ) : (
      <Alert
        title={t(
          'alerting.duplicate-message-template.title-error-loading-notification-template',
          'Error loading notification template'
        )}
        severity="error"
      >
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!template) {
    return notFoundComponent;
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
        text: t('alerting.notification-templates.duplicate.title', 'Duplicate notification template group'),
        subTitle: t(
          'alerting.notification-templates.duplicate.subTitle',
          'Duplicate a group of notification templates'
        ),
        parentItem: {
          text: t('alerting.common.titles.notification-templates', 'Notification Templates'),
          url: parentUrl,
        },
      }}
    >
      <DuplicateMessageTemplateComponent />
    </AlertmanagerPageWrapper>
  );
}

export default withPageErrorBoundary(DuplicateMessageTemplate);
