import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack } from '@grafana/experimental';
import { Card, Icon, Link, Text, useStyles2 } from '@grafana/ui';

import { RuleFormType, RuleFormValues } from '../../types/rule-form';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';

import LabelsField from './LabelsField';
import { NeedHelpInfo } from './NeedHelpInfo';
import { RuleEditorSection } from './RuleEditorSection';
import { NotificationPreview } from './notificaton-preview/NotificationPreview';

type NotificationsStepProps = {
  alertUid?: string;
};
export const NotificationsStep = ({ alertUid }: NotificationsStepProps) => {
  const styles = useStyles2(getStyles);
  const { watch, getValues } = useFormContext<RuleFormValues & { location?: string }>();

  const [type, labels, queries, condition, folder, alertName] = watch([
    'type',
    'labels',
    'queries',
    'condition',
    'folder',
    'name',
  ]);

  const dataSourceName = watch('dataSourceName') ?? GRAFANA_RULES_SOURCE_NAME;
  const hasLabelsDefined = getNonEmptyLabels(getValues('labels')).length > 0;

  const shouldRenderPreview = Boolean(condition) && Boolean(folder) && type === RuleFormType.grafana;

  const NotificationsStepDescription = () => {
    return (
      <Stack direction="row" gap={0.5} alignItems="baseline">
        <Text variant="bodySmall" color="secondary">
          Add custom labels to change the way your notifications are routed.
        </Text>
        <NeedHelpInfo
          contentText={
            <Stack gap={1}>
              <Stack direction="row" gap={0}>
                <>
                  Firing alert rule instances are routed to notification policies based on matching labels. All alert
                  rules and instances, irrespective of their labels, match the default notification policy. If there are
                  no nested policies, or no nested policies match the labels in the alert rule or alert instance, then
                  the default notification policy is the matching policy.
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
                  Custom labels change the way your notifications are routed. First, add labels to your alert rule and
                  then connect them to your notification policy by adding label matchers.
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
      </Stack>
    );
  };

  return (
    <RuleEditorSection
      stepNo={type === RuleFormType.cloudRecording ? 4 : 5}
      title={type === RuleFormType.cloudRecording ? 'Add labels' : 'Configure notifications'}
      description={
        <Stack direction="row" gap={0.5} alignItems="baseline">
          {type === RuleFormType.cloudRecording ? (
            <Text variant="bodySmall" color="secondary">
              Add labels to help you better manage your recording rules
            </Text>
          ) : (
            <NotificationsStepDescription />
          )}
        </Stack>
      }
    >
      <LabelsField dataSourceName={dataSourceName} />
      {shouldRenderPreview &&
        condition &&
        folder && ( // need to check for condition and folder again because of typescript
          <NotificationPreview
            alertQueries={queries}
            customLabels={labels}
            condition={condition}
            folder={folder}
            alertName={alertName}
            alertUid={alertUid}
          />
        )}
    </RuleEditorSection>
  );
};

interface Label {
  key: string;
  value: string;
}

function getNonEmptyLabels(labels: Label[]) {
  return labels.filter((label) => label.key && label.value);
}

const getStyles = (theme: GrafanaTheme2) => ({
  contentWrapper: css`
    display: flex;
    align-items: center;
    margin-top: ${theme.spacing(2)};
  `,
});
