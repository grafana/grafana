import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';

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
  'notification policy' = 'notification policy',
  'contact point' = 'contact point',
}

export const NotificationsStep = ({ alertUid }: NotificationsStepProps) => {
  const { watch } = useFormContext<RuleFormValues & { location?: string }>();
  const styles = useStyles2(getStyles);

  const [type, labels, queries, condition, folder, alertName] = watch([
    'type',
    'labels',
    'queries',
    'condition',
    'folder',
    'name',
  ]);

  const dataSourceName = watch('dataSourceName') ?? GRAFANA_RULES_SOURCE_NAME;

  const shouldRenderPreview = type === RuleFormType.grafana;

  const [routingOption, setRoutingOption] = useState<RoutingOptions>(RoutingOptions['contact point']);

  const routingOptions = [
    { label: 'Manually selected contact point', value: RoutingOptions['contact point'] },
    { label: 'Auto-select contact point', value: RoutingOptions['notification policy'] },
  ];

  const onRoutingOptionChange = useCallback(
    (option: RoutingOptions) => {
      setRoutingOption(option);
    },
    [setRoutingOption]
  );

  const simplifiedRoutingToggleEnabled = config.featureToggles.alertingSimplifiedRouting ?? false;

  const shouldAllowSimplifiedRouting = type === RuleFormType.grafana && simplifiedRoutingToggleEnabled;

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
            value={routingOption}
            onChange={onRoutingOptionChange}
            className={styles.routingOptions}
          />
        </Stack>

        <NotificationsOptionDescription routingOption={routingOption} routingOptionEnabled={true} />

        {routingOption === RoutingOptions['contact point'] ? (
          <div className={styles.simplifiedRouting}>
            <SimplifiedRouting />
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
};

function NeedHelpInfoForNotificationPolicy() {
  return (
    <NeedHelpInfo
      contentText={
        <Stack gap={1}>
          <Stack direction="row" gap={0}>
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
          <Stack direction="row" gap={0}>
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
        <Stack direction="row" gap={0}>
          <>
            Select a contact point to notify all recipients in it. Notifications for firing alert instances are grouped
            based on folder and alert rule name. The waiting time until the initial notification is sent for a new group
            created by an incoming alert is 30 seconds. The waiting time to send a batch of new alerts for that group
            after the first notification was sent is 5 minutes. The waiting time to resend an alert after they have
            successfully been sent is 4 hours. Grouping and wait time values are defined in your default notification
            policy.
          </>
          <a
            href={`https://grafana.com/docs/grafana/latest/alerting/fundamentals/notification-policies/notifications/`}
            target="_blank"
            rel="noreferrer"
          >
            <Text color="link">
              Read more about notifiying contact points. <Icon name="external-link-alt" />
            </Text>
          </a>
        </Stack>
      }
      title="Notifify contact points"
    />
  );
}
interface NotificationsStepDescriptionProps {
  routingOption: RoutingOptions;
  routingOptionEnabled: boolean;
}

export const NotificationsOptionDescription = ({
  routingOption,
  routingOptionEnabled,
}: NotificationsStepDescriptionProps) => {
  const styles = useStyles2(getStyles);
  const getRoutingOptionHeader = useCallback((routingOptionEnabled: boolean, routingOption: RoutingOptions) => {
    if (!routingOptionEnabled || routingOption === 'notification policy') {
      return 'Notifications for firing alerts are routed to contact points based on matching labels.';
    }
    return 'Notifications for firing alerts are routed a selected contact point.';
  }, []);
  return (
    <div className={styles.notificationsOptionDescription}>
      <Text variant="bodySmall" color="secondary">
        {getRoutingOptionHeader(routingOptionEnabled, routingOption)}
      </Text>
      {routingOption === RoutingOptions['notification policy'] && <NeedHelpInfoForNotificationPolicy />}
      {routingOption === RoutingOptions['contact point'] && <NeedHelpInfoForContactpoint />}
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
