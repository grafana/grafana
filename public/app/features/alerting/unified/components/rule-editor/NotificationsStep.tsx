import { css } from '@emotion/css';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { RadioButtonGroup, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { KBObjectArray, RuleFormType, RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isGrafanaManagedRuleByType, isGrafanaRecordingRuleByType, isRecordingRuleByType } from '../../utils/rules';

import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection } from './RuleEditorSection';
import { SimplifiedRouting } from './alert-rule-form/simplifiedRouting/SimplifiedRouting';
import { LabelsEditorModal } from './labels/LabelsEditorModal';
import { LabelsFieldInForm } from './labels/LabelsFieldInForm';
import { NotificationPreview } from './notificaton-preview/NotificationPreview';

type NotificationsStepProps = {
  alertUid?: string;
};

enum RoutingOptions {
  NotificationPolicy = 'notification policy',
  ContactPoint = 'contact point',
}

function useHasInternalAlertmanagerEnabled() {
  const { useGetGrafanaAlertingConfigurationStatusQuery } = alertmanagerApi;
  const { currentData: amChoiceStatus } = useGetGrafanaAlertingConfigurationStatusQuery(undefined);
  return (
    amChoiceStatus?.alertmanagersChoice === AlertmanagerChoice.Internal ||
    amChoiceStatus?.alertmanagersChoice === AlertmanagerChoice.All
  );
}

export const NotificationsStep = ({ alertUid }: NotificationsStepProps) => {
  const { watch, getValues, setValue } = useFormContext<RuleFormValues>();
  const styles = useStyles2(getStyles);

  const [type, manualRouting] = watch(['type', 'manualRouting']);
  const [showLabelsEditor, setShowLabelsEditor] = useState(false);

  const dataSourceName = watch('dataSourceName') ?? GRAFANA_RULES_SOURCE_NAME;
  const isGrafanaManaged = isGrafanaManagedRuleByType(type);
  const simplifiedModeInNotificationsStepEnabled = config.featureToggles.alertingNotificationsStepMode ?? false;
  const shouldRenderpreview = type === RuleFormType.grafana;
  const hasInternalAlertmanagerEnabled = useHasInternalAlertmanagerEnabled();

  const shouldAllowSimplifiedRouting = type === RuleFormType.grafana && hasInternalAlertmanagerEnabled;

  function onCloseLabelsEditor(labelsToUpdate?: KBObjectArray) {
    if (labelsToUpdate) {
      setValue('labels', labelsToUpdate);
    }
    setShowLabelsEditor(false);
  }

  if (isGrafanaRecordingRuleByType(type)) {
    return null;
  }

  const step = !isGrafanaManaged ? 4 : 5;

  const switchMode =
    isGrafanaManaged && simplifiedModeInNotificationsStepEnabled
      ? {
          isAdvancedMode: !manualRouting,
          setAdvancedMode: (isAdvanced: boolean) => {
            setValue('editorSettings.simplifiedNotificationEditor', !isAdvanced);
            setValue('manualRouting', !isAdvanced);
          },
        }
      : undefined;

  const title = (() => {
    if (isRecordingRuleByType(type)) {
      return 'Add labels';
    }
    if (isGrafanaManaged) {
      return 'Configure notifications';
    }
    return 'Configure labels and notifications';
  })();

  return (
    <RuleEditorSection
      stepNo={step}
      title={title}
      description={
        <Stack direction="row" gap={0.5} alignItems="center">
          {isRecordingRuleByType(type) ? (
            <Text variant="bodySmall" color="secondary">
              <Trans i18nKey="alerting.notifications-step.labels-better-manage-recording-rules">
                Add labels to help you better manage your recording rules.
              </Trans>
            </Text>
          ) : (
            shouldAllowSimplifiedRouting && (
              <Text variant="bodySmall" color="secondary">
                <Trans i18nKey="alerting.notifications-step.recipient-notification-fires">
                  Select who should receive a notification when an alert rule fires.
                </Trans>
              </Text>
            )
          )}
        </Stack>
      }
      switchMode={switchMode}
      fullWidth
    >
      {!isGrafanaManaged && (
        <>
          <LabelsFieldInForm onEditClick={() => setShowLabelsEditor(true)} />
          <LabelsEditorModal
            isOpen={showLabelsEditor}
            onClose={onCloseLabelsEditor}
            dataSourceName={dataSourceName}
            initialLabels={getValues('labels')}
          />
        </>
      )}
      {shouldAllowSimplifiedRouting && (
        <div className={styles.configureNotifications}>
          <Text element="h5">
            <Trans i18nKey="alerting.notifications-step.recipient">Recipient</Trans>
          </Text>
        </div>
      )}
      {shouldAllowSimplifiedRouting && simplifiedModeInNotificationsStepEnabled && (
        <ManualAndAutomaticRoutingSimplified alertUid={alertUid} />
      )}
      {shouldAllowSimplifiedRouting && !simplifiedModeInNotificationsStepEnabled && (
        <ManualAndAutomaticRouting alertUid={alertUid} />
      )}
      {!shouldAllowSimplifiedRouting && shouldRenderpreview && <AutomaticRooting alertUid={alertUid} />}
    </RuleEditorSection>
  );
};

/**
 * Preconditions:
 * - the alert rule is a grafana rule
 *
 * This component will render the switch between the select contact point routing and the notification policy routing.
 * It also renders the section body of the NotificationsStep, depending on the routing option selected.
 * If select contact point routing is selected, it will render the SimplifiedRouting component.
 * If notification policy routing is selected, it will render the AutomaticRouting component.
 *
 */
function ManualAndAutomaticRouting({ alertUid }: { alertUid?: string }) {
  const { watch, setValue } = useFormContext<RuleFormValues>();
  const styles = useStyles2(getStyles);

  const [manualRouting] = watch(['manualRouting']);

  const routingOptions = [
    {
      label: t(
        'alerting.manual-and-automatic-routing.routing-options.label.select-contact-point',
        'Select contact point'
      ),
      value: RoutingOptions.ContactPoint,
    },
    {
      label: t(
        'alerting.manual-and-automatic-routing.routing-options.label.use-notification-policy',
        'Use notification policy'
      ),
      value: RoutingOptions.NotificationPolicy,
    },
  ];

  const onRoutingOptionChange = (option: RoutingOptions) => {
    setValue('manualRouting', option === RoutingOptions.ContactPoint);
  };

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column">
        <RadioButtonGroup
          data-testid={manualRouting ? 'routing-options-contact-point' : 'routing-options-notification-policy'}
          options={routingOptions}
          value={manualRouting ? RoutingOptions.ContactPoint : RoutingOptions.NotificationPolicy}
          onChange={onRoutingOptionChange}
          className={styles.routingOptions}
        />
      </Stack>

      <RoutingOptionDescription manualRouting={manualRouting} />

      {manualRouting ? <SimplifiedRouting /> : <AutomaticRooting alertUid={alertUid} />}
    </Stack>
  );
}

/**
 * Preconditions:
 * - simple mode for notifications step is enabled
 * - the alert rule is a grafana rule
 *
 * This component will render the switch between the select contact point routing and the notification policy routing.
 * It also renders the section body of the NotificationsStep, depending on the routing option selected.
 * If select contact point routing is selected, it will render the SimplifiedRouting component.
 * If notification policy routing is selected, it will render the AutomaticRouting component.
 *
 */
function ManualAndAutomaticRoutingSimplified({ alertUid }: { alertUid?: string }) {
  const { watch } = useFormContext<RuleFormValues>();

  const [manualRouting] = watch(['manualRouting']);

  return (
    <Stack direction="column" gap={2}>
      <RoutingOptionDescription manualRouting={manualRouting} />

      {manualRouting ? <SimplifiedRouting /> : <AutomaticRooting alertUid={alertUid} />}
    </Stack>
  );
}

interface AutomaticRootingProps {
  alertUid?: string;
}

function AutomaticRooting({ alertUid }: AutomaticRootingProps) {
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
    <NotificationPreview
      alertQueries={queries}
      customLabels={labels}
      condition={condition}
      folder={folder}
      alertName={alertName}
      alertUid={alertUid}
    />
  );
}

// Auxiliar components to build the texts and descriptions in the NotificationsStep
function NeedHelpInfoForNotificationPolicy() {
  return (
    <NeedHelpInfo
      contentText={
        <Stack gap={1} direction="column">
          <Stack direction="column" gap={0}>
            <Trans i18nKey="alerting.need-help-info-for-notification-policy.notification-policies">
              Firing alert instances are routed to notification policies based on matching labels. The default
              notification policy matches all alert instances.
            </Trans>
          </Stack>
          <Stack direction="column" gap={0}>
            <Trans i18nKey="alerting.need-help-info-for-notification-policy.custom-labels">
              Custom labels change the way your notifications are routed. First, add labels to your alert rule and then
              connect them to your notification policy by adding label matchers.
            </Trans>
            <TextLink
              href={`https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/notification-policies/`}
              external
            >
              <Trans i18nKey="alerting.need-help-info-for-notification-policy.read-more">
                Read about notification policies.
              </Trans>
            </TextLink>
          </Stack>
        </Stack>
      }
      title={t('alerting.need-help-info-for-notification-policy.title-notification-routing', 'Notification routing')}
    />
  );
}

function NeedHelpInfoForContactpoint() {
  return (
    <NeedHelpInfo
      contentText={
        <>
          <Trans i18nKey="alerting.need-help-info-for-contactpoint.select-contact-point">
            Select a contact point to notify all recipients in it.
          </Trans>
          <br />
          <Trans i18nKey="alerting.need-help-info-for-contactpoint.customize-notifications">
            Muting, grouping, and timings options allow you to customize how notifications are sent.
          </Trans>
          <br />
          <br />
          <Trans i18nKey="alerting.need-help-info-for-contactpoint.notification-policies">
            Alternatively, toggle the <b>Advanced options</b> button to route notifications using notification policies
            for greater flexibility.
          </Trans>
        </>
      }
      externalLink="https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/"
      linkText="Read more about notifications"
      title={t(
        'alerting.need-help-info-for-contactpoint.title-notify-by-selecting-a-contact-point',
        'Notify by selecting a contact point'
      )}
    />
  );
}
interface NotificationsStepDescriptionProps {
  manualRouting: boolean;
}

export const RoutingOptionDescription = ({ manualRouting }: NotificationsStepDescriptionProps) => {
  return (
    <Stack alignItems="center">
      <Text variant="bodySmall" color="secondary">
        {manualRouting
          ? t(
              'alerting.routing-option-description.manual',
              'Notifications for firing alerts are routed to a selected contact point.'
            )
          : t(
              'alerting.routing-option-description.matching-labels',
              'Notifications for firing alerts are routed to contact points based on matching labels and the notification policy tree.'
            )}
      </Text>
      {manualRouting ? <NeedHelpInfoForContactpoint /> : <NeedHelpInfoForNotificationPolicy />}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  routingOptions: css({
    width: 'fit-content',
  }),
  configureNotifications: css({
    display: 'flex',
    flexDirection: 'column',
    marginTop: theme.spacing(2),
  }),
});
