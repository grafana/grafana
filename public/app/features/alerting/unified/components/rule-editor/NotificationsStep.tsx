import { css } from '@emotion/css';
import React from 'react';
import { useFormContext } from 'react-hook-form';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Link, useStyles2 } from '@grafana/ui';

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
      <div className={styles.stepDescription}>
        <div>
          Grafana handles the notifications for alerts by assigning labels to alerts. These labels connect alerts to
          contact points and silence alert instances that have matching labels.
        </div>

        <NeedHelpInfo
          contentText={`Firing alert rule instances are routed to notification policies based on matching labels. Notification are sent out to the contact point specified in the notification policy.`}
          externalLink={`https://grafana.com/docs/grafana/latest/alerting/fundamentals/notification-policies/notifications/`}
          linkText={`Read about notification routing`}
          title="Notification routing"
        />
      </div>
    );
  };

  return (
    <RuleEditorSection
      stepNo={type === RuleFormType.cloudRecording ? 4 : 5}
      title={type === RuleFormType.cloudRecording ? 'Labels' : 'Notifications'}
      description={
        type === RuleFormType.cloudRecording ? (
          'Add labels to help you better manage your recording rules'
        ) : (
          <NotificationsStepDescription />
        )
      }
    >
      <div className={styles.contentWrapper}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {!hasLabelsDefined && type !== RuleFormType.cloudRecording && (
            <Card className={styles.card}>
              <Card.Heading>Root route – default for all alerts</Card.Heading>
              <Card.Description>
                Without custom labels, your alert will be routed through the root route. To view and edit the root
                route, go to <Link href="/alerting/routes">notification policies</Link> or contact your admin in case
                you are using non-Grafana alert management.
              </Card.Description>
            </Card>
          )}
          <LabelsField dataSourceName={dataSourceName} />
        </div>
      </div>
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
  hideButton: css`
    color: ${theme.colors.text.secondary};
    cursor: pointer;
    margin-bottom: ${theme.spacing(1)};
  `,
  card: css`
    max-width: 500px;
  `,
  flowChart: css`
    margin-right: ${theme.spacing(3)};
  `,
  title: css`
    margin-bottom: ${theme.spacing(2)};
  `,
  stepDescription: css`
    margin-bottom: ${theme.spacing(2)};
    display: flex;
    gap: ${theme.spacing(1)};
)};
  `,
});
