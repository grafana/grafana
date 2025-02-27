import { ComponentPropsWithoutRef, Suspense, lazy } from 'react';
import { useFormContext } from 'react-hook-form';

import { config } from '@grafana/runtime';
import { LoadingPlaceholder } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { isGrafanaManagedRuleByType, isGrafanaRecordingRuleByType, isRecordingRuleByType } from '../../utils/rules';

import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection, RuleEditorSubSection } from './RuleEditorSection';
import { SimplifiedRouting } from './alert-rule-form/simplifiedRouting/SimplifiedRouting';
const NotificationPreview = lazy(() => import('./notificaton-preview/NotificationPreview'));

type NotificationsStepProps = {
  alertUid?: string;
};

function useHasInternalAlertmanagerEnabled() {
  const { useGetGrafanaAlertingConfigurationStatusQuery } = alertmanagerApi;
  const { currentData: amChoiceStatus } = useGetGrafanaAlertingConfigurationStatusQuery(undefined);
  return (
    amChoiceStatus?.alertmanagersChoice === AlertmanagerChoice.Internal ||
    amChoiceStatus?.alertmanagersChoice === AlertmanagerChoice.All
  );
}

export const NotificationsStep = ({ alertUid }: NotificationsStepProps) => {
  const { watch, setValue } = useFormContext<RuleFormValues>();

  const [type, simplifiedRoutingMode] = watch(['type', 'manualRouting']);

  const isGrafanaManaged = isGrafanaManagedRuleByType(type);
  const simplifiedRoutingToggleEnabled = config.featureToggles.alertingSimplifiedRouting ?? false;
  const simplifiedModeInNotificationsStepEnabled = config.featureToggles.alertingNotificationsStepMode ?? false;
  const shouldRenderPreview = type === RuleFormType.grafana;
  const hasInternalAlertmanagerEnabled = useHasInternalAlertmanagerEnabled();

  const shouldAllowSimplifiedRouting =
    type === RuleFormType.grafana && simplifiedRoutingToggleEnabled && hasInternalAlertmanagerEnabled;

  if (isGrafanaRecordingRuleByType(type)) {
    return null;
  }

  const isRecordingRule = isRecordingRuleByType(type);

  const step = !isGrafanaManaged ? 4 : 5;

  const switchMode =
    isGrafanaManaged && simplifiedModeInNotificationsStepEnabled
      ? {
          isAdvancedMode: !simplifiedRoutingMode,
          setAdvancedMode: (isAdvanced: boolean) => {
            setValue('editorSettings.simplifiedNotificationEditor', !isAdvanced);
            setValue('manualRouting', !isAdvanced);
          },
        }
      : undefined;

  const title = isRecordingRule
    ? 'Add labels'
    : isGrafanaManaged
      ? 'Configure notifications'
      : 'Configure labels and notifications';

  let description = isRecordingRule
    ? 'Add labels to help you better manage your recording rules.'
    : 'Select who should receive a notification when an alert rule fires.';

  if (shouldAllowSimplifiedRouting) {
    description = simplifiedRoutingMode
      ? 'Notifications for firing alerts are routed to a selected contact point.'
      : 'Notifications for firing alerts are routed to contact points based on matching labels and the notification policy tree.';
  }

  return (
    <RuleEditorSection
      stepNo={step}
      title={title}
      description={description}
      switchMode={switchMode}
      helpInfo={simplifiedRoutingMode ? needHelpInfoForContactPoint : needHelpInfoForNotificationPolicy}
    >
      {/* simplified routing mode */}
      {simplifiedRoutingMode && <SimplifiedRouting />}

      {/* advanced routing mode (using notification policies) */}
      {!simplifiedRoutingMode && shouldRenderPreview && (
        <RuleEditorSubSection
          title={<Trans i18nKey="alerting.notification-preview.title">Alert instance routing preview</Trans>}
          description={
            <Trans i18nKey="alerting.notification-preview.initialized">
              Based on the labels added, alert instances are routed to the following notification policies. Expand each
              notification policy below to view more details.
            </Trans>
          }
          fullWidth
        >
          <PreviewNotificationPolicyRouting alertUid={alertUid} />
        </RuleEditorSubSection>
      )}

      {/* show only label configuration for data source managed rule (alerting and recording) */}
      {/* @TODO */}
    </RuleEditorSection>
  );
};

interface NotificationPolicyRoutingProps {
  alertUid?: string;
}

function PreviewNotificationPolicyRouting({ alertUid }: NotificationPolicyRoutingProps) {
  const { watch } = useFormContext<RuleFormValues>();
  const [labels, queries, condition, folder, alertName] = watch([
    'labels',
    'queries',
    'condition',
    'folder',
    'name',
    'manualRouting',
  ]);
  return (
    <Suspense fallback={<LoadingPlaceholder text="Loading..." />}>
      <NotificationPreview
        alertQueries={queries}
        customLabels={labels}
        condition={condition}
        folder={folder}
        alertName={alertName}
        alertUid={alertUid}
      />
    </Suspense>
  );
}

// build the texts and descriptions in the NotificationsStep
const needHelpInfoForNotificationPolicy: ComponentPropsWithoutRef<typeof NeedHelpInfo> = {
  title: 'Notification routing',
  contentText: (
    <>
      <p>
        Firing alert instances are routed to notification policies based on matching labels. The default notification
        policy matches all alert instances.
      </p>
      <p>
        Custom labels change the way your notifications are routed. First, add labels to your alert rule and then
        connect them to your notification policy by adding label matchers.
      </p>
    </>
  ),
  externalLink: 'https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/notification-policies/',
  linkText: 'Read about notification policies.',
};

const needHelpInfoForContactPoint: ComponentPropsWithoutRef<typeof NeedHelpInfo> = {
  title: 'Notify contact points',
  contentText: (
    <>
      <p>Select a contact point to notify all recipients in it.</p>
      <p>Notifications for firing alert instances are grouped based on folder and alert rule name.</p>
      <p>The wait time before sending the first notification for a new group of alerts is 30 seconds.</p>
      <p>
        The waiting time before sending a notification about changes in the alert group after the first notification has
        been sent is 5 minutes.
      </p>
      <p>The wait time before resending a notification that has already been sent successfully is 4 hours.</p>
      <p>Grouping and wait time values are defined in your default notification policy.</p>
    </>
  ),
  externalLink: 'https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/',
  linkText: 'Read more about notifications',
};
