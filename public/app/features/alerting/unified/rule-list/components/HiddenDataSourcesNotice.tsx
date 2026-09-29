import { t } from '@grafana/i18n';
import { Icon, Stack, Text } from '@grafana/ui';

interface Props {
  count: number;
}

/** Tells the user some data sources with no rules aren't shown, so the list isn't mistaken for the full set. */
export function HiddenDataSourcesNotice({ count }: Props) {
  if (count === 0) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Icon name="info-circle" size="sm" />
      <Text variant="bodySmall" color="secondary">
        {t('alerting.rule-list.hidden-empty-data-sources', '', {
          count,
          defaultValue_one: '{{count}} data source with no rules is hidden',
          defaultValue_other: '{{count}} data sources with no rules are hidden',
        })}
      </Text>
    </Stack>
  );
}
