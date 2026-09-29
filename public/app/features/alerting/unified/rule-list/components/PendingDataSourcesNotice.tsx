import { t } from '@grafana/i18n';
import { Spinner, Stack, Text } from '@grafana/ui';

interface Props {
  count: number;
}

/** Tells the user N more data sources are still being checked, so an empty-looking list isn't mistaken for a complete one. */
export function PendingDataSourcesNotice({ count }: Props) {
  if (count === 0) {
    return null;
  }

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      <Spinner size="sm" inline />
      <Text variant="bodySmall" color="secondary">
        {t('alerting.rule-list.checking-data-sources', '', {
          count,
          defaultValue_one: 'Checking {{count}} more data source',
          defaultValue_other: 'Checking {{count}} more data sources',
        })}
      </Text>
    </Stack>
  );
}
