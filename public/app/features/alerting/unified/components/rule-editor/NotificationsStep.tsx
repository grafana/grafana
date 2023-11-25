import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Icon, RadioButtonGroup, Stack, Text, useStyles2 } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import LabelsField from './LabelsField';
import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection } from './RuleEditorSection';
import { SimplifiedRouting } from './alert-rule-form/simplifiedRouting/SimplifiedRouting';
import { NotificationPreview } from './notificaton-preview/NotificationPreview';

type NotificationsStepProps = {
  alertUid?: string;
};

enum RoutingOptions {
  NotificationPolicy = 'notification policy',
  ContactPoint = 'contact point',
}

export const NotificationsStep = ({ alertUid }: NotificationsStepProps) => {
  const { watch, setValue } = useFormContext<RuleFormValues>();
  const styles = useStyles2(getStyles);

  const [type, labels, queries, condition, folder, alertName, manualRouting] = watch([
    'type',
    'labels',
    'queries',
    'condition',
    'folder',
    'name',
    'manualRouting',
  ]);

  const dataSourceName = watch('dataSourceName') ?? GRAFANA_RULES_SOURCE_NAME;

  const shouldRenderPreview = type === RuleFormType.grafana;

  const routingOptions = [
    { label: 'Manually select contact point', value: RoutingOptions.ContactPoint },
    { label: 'Auto-select contact point', value: RoutingOptions.NotificationPolicy },
  ];

  const onRoutingOptionChange = (option: RoutingOptions) => {
    setValue('manualRouting', option === RoutingOptions.ContactPoint);
  };

  const simplifiedRoutingToggleEnabled = config.featureToggles.alertingSimplifiedRouting ?? false;

  const shouldAllowSimplifiedRouting = type === RuleFormType.grafana && simplifiedRoutingToggleEnabled;
  const [isOpenRoutingSettings, toggleOpenRoutingSettings] = useToggle(false);

  return (
    <RuleEditorSection
      stepNo={type === RuleFormType.cloudRecording ? 4 : 5}
      title={type === RuleFormType.cloudRecording ? 'Add labels' : 'Labels and notifications'}
      description={
        <Stack direction="row" gap={0.5} alignItems="baseline">
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
      <LabelsField dataSourceName={dataSourceName} />
      {shouldAllowSimplifiedRouting && (
        <div className={styles.configureNotifications}>
          <Text element="h5">Configure notifications</Text>
          <Text variant="bodySmall" color="secondary">
            Select who should receive a notification when an alert rule fires.
          </Text>
        </div>
      )}
      <RuleEditorSectionBody />
    </RuleEditorSection>
  );

  /**
   * This component is used to render the section body of the NotificationsStep, depending on the routing option selected.
   * If simplified routing is not enabled, it will render the NotificationPreview component.
   * If simplified routing is enabled, it will render the switch between the manual routing and the notification policy routing.
   *
   */
  function RuleEditorSectionBody() {
    if (!shouldAllowSimplifiedRouting) {
      return (
        <>
          {shouldRenderPreview && (
            <NotificationPreview
              alertQueries={queries}
              customLabels={labels}
              condition={condition}
              folder={folder}
              alertName={alertName}
              alertUid={alertUid}
            />
          )}
        </>
      );
    }
    return (
      <Stack direction="column">
        <Stack direction="column">
          <RadioButtonGroup
            options={routingOptions}
            value={manualRouting ? RoutingOptions.ContactPoint : RoutingOptions.NotificationPolicy}
            onChange={onRoutingOptionChange}
            className={styles.routingOptions}
          />
        </Stack>

        <RoutingOptionDescription manualRouting={manualRouting} />

        {manualRouting ? (
          <div className={styles.simplifiedRouting}>
            <SimplifiedRouting
              isOpenRoutingSettings={isOpenRoutingSettings}
              toggleOpenRoutingSettings={toggleOpenRoutingSettings}
            />
          </div>
        ) : (
          shouldRenderPreview && (
            <NotificationPreview
              alertQueries={queries}
              customLabels={labels}
              condition={condition}
              folder={folder}
              alertName={alertName}
              alertUid={alertUid}
            />
          )
        )}
      </Stack>
    );
  }
};

// Auxiliar components to build the texts and descriptions in the NotificationsStep
function NeedHelpInfoForNotificationPolicy() {
  return (
    <NeedHelpInfo
      contentText={
        <Stack gap={1} direction="column">
          <Stack direction="column" gap={0}>
            <>
              Firing alert rule instances are routed to notification policies based on matching labels. All alert rules
              and instances, irrespective of their labels, match the default notification policy. If there are no nested
              policies, or no nested policies match the labels in the alert rule or alert instance, then the default
              notification policy is the matching policy.
            </>
            <a
              href={`https://grafana.com/docs/grafana/latest/alerting/fundamentals/notification-policies/notifications/`}
              target="_blank"
              rel="noreferrer"
            >
              <Text color="link">
                Read about notification routing. <Icon name="external-link-alt" />
              </Text>
            </a>
          </Stack>
          <Stack direction="column" gap={0}>
            <>
              Custom labels change the way your notifications are routed. First, add labels to your alert rule and then
              connect them to your notification policy by adding label matchers.
            </>
            <a
              href={`https://grafana.com/docs/grafana/latest/alerting/fundamentals/annotation-label/`}
              target="_blank"
              rel="noreferrer"
            >
              <Text color="link">
                Read about Labels and annotations. <Icon name="external-link-alt" />
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
          The waiting time until the initial notification is sent for a new group created by an incoming alert is 30
          seconds.
          <br />
          The waiting time to send a batch of new alerts for that group after the first notification was sent is 5
          minutes.
          <br />
          The waiting time to resend an alert after they have successfully been sent is 4 hours.
          <br />
          Grouping and wait time values are defined in your default notification policy.
        </>
      }
      // todo: update the link with the new documentation about simplified routing
      externalLink="`https://grafana.com/docs/grafana/latest/alerting/fundamentals/notification-policies/notifications/`"
      linkText="Read more about notifiying contact points"
      title="Notify contact points"
    />
  );
}
interface NotificationsStepDescriptionProps {
  manualRouting: boolean;
}

export const RoutingOptionDescription = ({ manualRouting }: NotificationsStepDescriptionProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.notificationsOptionDescription}>
      <Text variant="bodySmall" color="secondary">
        {manualRouting
          ? 'Notifications for firing alerts are routed to a selected contact point.'
          : 'Notifications for firing alerts are routed to contact points based on matching labels.'}
      </Text>
      {manualRouting ? <NeedHelpInfoForContactpoint /> : <NeedHelpInfoForNotificationPolicy />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  routingOptions: css({
    marginTop: theme.spacing(2),
    width: 'fit-content',
  }),
  simplifiedRouting: css({
    display: 'flex',
    flexDirection: 'column',
    marginTop: theme.spacing(2),
  }),
  configureNotifications: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  }),
  notificationsOptionDescription: css({
    marginTop: theme.spacing(1),
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing(0.5),
  }),
});
