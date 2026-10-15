import { type AlertRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import { t } from '@grafana/i18n';
import { Stack, Text, TextLink } from '@grafana/ui';

import { createContactPointSearchLink } from '../../utils/misc';

import { DeletedRuleReviewField } from './DeletedRuleReviewField';

type NotificationSettings = NonNullable<AlertRule['spec']['notificationSettings']>;

export function DeletedRuleNotificationSettings({ settings }: { settings: NotificationSettings }) {
  return (
    <Stack direction="column" gap={1}>
      <Text variant="bodySmall" color="secondary">
        {t('alerting.deleted-rules.review.notification-settings', 'Notification settings')}
      </Text>
      {'routingTree' in settings ? (
        <DeletedRuleReviewField
          label={t('alerting.deleted-rules.review.notification-policy', 'Notification policy')}
          value={settings.routingTree}
        />
      ) : (
        <SimplifiedRoutingFields settings={settings} />
      )}
    </Stack>
  );
}

function SimplifiedRoutingFields({ settings }: { settings: Exclude<NotificationSettings, { routingTree: string }> }) {
  const overrides = [
    {
      label: t('alerting.deleted-rules.review.group-by', 'Group by'),
      value: settings.groupBy?.join(', '),
    },
    { label: t('alerting.deleted-rules.review.group-wait', 'Group wait'), value: settings.groupWait },
    { label: t('alerting.deleted-rules.review.group-interval', 'Group interval'), value: settings.groupInterval },
    { label: t('alerting.deleted-rules.review.repeat-interval', 'Repeat interval'), value: settings.repeatInterval },
    {
      label: t('alerting.deleted-rules.review.mute-timings', 'Mute timings'),
      value: settings.muteTimeIntervals?.join(', '),
    },
    {
      label: t('alerting.deleted-rules.review.active-timings', 'Active timings'),
      value: settings.activeTimeIntervals?.join(', '),
    },
  ];

  return (
    <>
      <DeletedRuleReviewField
        label={t('alerting.deleted-rules.review.contact-point', 'Contact point')}
        value={
          <TextLink href={createContactPointSearchLink(settings.receiver)} inline={false}>
            {settings.receiver}
          </TextLink>
        }
      />
      {overrides.map(({ label, value }) => value && <DeletedRuleReviewField key={label} label={label} value={value} />)}
    </>
  );
}
