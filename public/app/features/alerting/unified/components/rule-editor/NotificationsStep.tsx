import { css } from '@emotion/css';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, RadioButtonGroup, Stack, Text, useStyles2 } from '@grafana/ui';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../../api/alertmanagerApi';
import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

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

  const [type] = watch(['type', 'labels', 'queries', 'condition', 'folder', 'name', 'manualRouting']);
  const [showLabelsEditor, setShowLabelsEditor] = useState(false);

  const dataSourceName = watch('dataSourceName') ?? GRAFANA_RULES_SOURCE_NAME;
  const simplifiedRoutingToggleEnabled = config.featureToggles.alertingSimplifiedRouting ?? false;
  const shouldRenderpreview = type === RuleFormType.grafana;
  const hasInternalAlertmanagerEnabled = useHasInternalAlertmanagerEnabled();

  const shouldAllowSimplifiedRouting =
    type === RuleFormType.grafana && simplifiedRoutingToggleEnabled && hasInternalAlertmanagerEnabled;

  function onCloseLabelsEditor(
    labelsToUpdate?: Array<{
      key: string;
      value: string;
    }>
  ) {
    if (labelsToUpdate) {
      setValue('labels', labelsToUpdate);
    }
    setShowLabelsEditor(false);
  }

  return (
    <RuleEditorSection
      stepNo={4}
      title={type === RuleFormType.cloudRecording ? 'Add labels' : 'Configure labels and notifications'}
      description={
        <Stack direction="row" gap={0.5} alignItems="center">
          {type === RuleFormType.cloudRecording ? (
            <Text variant="bodySmall" color="secondary">
              Add labels to help you better manage your recording rules
            </Text>
          ) : (
            shouldAllowSimplifiedRouting && (
              <Text variant="bodySmall" color="secondary">
                Select who should receive a notification when an alert rule fires.
              </Text>
            )
          )}
        </Stack>
      }
      fullWidth
    >
      <LabelsFieldInForm onEditClick={() => setShowLabelsEditor(true)} />
      <LabelsEditorModal
        isOpen={showLabelsEditor}
        onClose={onCloseLabelsEditor}
        dataSourceName={dataSourceName}
        initialLabels={getValues('labels')}
      />
      {shouldAllowSimplifiedRouting && (
        <div className={styles.configureNotifications}>
          <Text element="h5">Notifications</Text>
          <Text variant="bodySmall" color="secondary">
            Select who should receive a notification when an alert rule fires.
          </Text>
        </div>
      )}
      {shouldAllowSimplifiedRouting ? ( // when simplified routing is enabled and is grafana rule
        <ManualAndAutomaticRouting alertUid={alertUid} />
      ) : // when simplified routing is not enabled, render the notification preview as we did before
      shouldRenderpreview ? (
        <AutomaticRooting alertUid={alertUid} />
      ) : null}
    </RuleEditorSection>
  );
};

/**
 * Preconditions:
 * - simplified routing is enabled
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
    { label: 'Select contact point', value: RoutingOptions.ContactPoint },
    { label: 'Use notification policy', value: RoutingOptions.NotificationPolicy },
  ];

  const onRoutingOptionChange = (option: RoutingOptions) => {
    setValue('manualRouting', option === RoutingOptions.ContactPoint);
  };

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column">
        <RadioButtonGroup
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
            <>
              Firing alert instances are routed to notification policies based on matching labels. The default
              notification policy matches all alert instances.
            </>
          </Stack>
          <Stack direction="column" gap={0}>
            <>
              Custom labels change the way your notifications are routed. First, add labels to your alert rule and then
              connect them to your notification policy by adding label matchers.
            </>
            <a
              href={`https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/notification-policies/`}
              target="_blank"
              rel="noreferrer"
            >
              <Text color="link">
                Read about notification policies. <Icon name="external-link-alt" />
              </Text>
            </a>
          </Stack>
        </Stack>
      }
      title="Notification routing"
    />
  );
}

function NeedHelpInfoForContactpoint() {
  return (
    <NeedHelpInfo
      contentText={
        <>
          Select a contact point to notify all recipients in it.
          <br />
          <br />
          Notifications for firing alert instances are grouped based on folder and alert rule name.
          <br />
          The wait time before sending the first notification for a new group of alerts is 30 seconds.
          <br />
          The waiting time before sending a notification about changes in the alert group after the first notification
          has been sent is 5 minutes.
          <br />
          The wait time before resending a notification that has already been sent successfully is 4 hours.
          <br />
          Grouping and wait time values are defined in your default notification policy.
        </>
      }
      externalLink="https://grafana.com/docs/grafana/latest/alerting/fundamentals/notifications/"
      linkText="Read more about notifications"
      title="Notify contact points"
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
          ? 'Notifications for firing alerts are routed to a selected contact point.'
          : 'Notifications for firing alerts are routed to contact points based on matching labels and the notification policy tree.'}
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
