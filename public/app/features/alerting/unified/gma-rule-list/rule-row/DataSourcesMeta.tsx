import { t } from '@grafana/i18n';
import { Stack, Text, TextLink, Tooltip } from '@grafana/ui';

import { getDataSourceByUid } from '../../utils/datasource';
import { makeDataSourceLink } from '../../utils/misc';

interface DataSourcesMetaProps {
  /** Unknown UIDs (deleted or not visible) are skipped. */
  uids: string[];
}

export function DataSourcesMeta({ uids }: DataSourcesMetaProps) {
  const dataSources = Array.from(new Set(uids))
    .map(getDataSourceByUid)
    .filter((ds): ds is NonNullable<typeof ds> => ds !== undefined);

  if (dataSources.length === 0) {
    return null;
  }

  if (dataSources.length === 1) {
    const [ds] = dataSources;
    return (
      <Stack direction="row" alignItems="center" gap={0.5}>
        <img alt="" src={ds.meta.info.logos.small} width={16} height={16} />
        <TextLink href={makeDataSourceLink(ds.uid)} variant="bodySmall" color="primary" inline={false}>
          {ds.name}
        </TextLink>
      </Stack>
    );
  }

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {dataSources.map((ds) => (
        <Tooltip key={ds.uid} content={ds.name}>
          <img alt={ds.name} src={ds.meta.info.logos.small} width={16} height={16} />
        </Tooltip>
      ))}
      <Text variant="bodySmall" color="secondary">
        {t('alerting.gma-rule-list.shared.data-sources-count', '', {
          count: dataSources.length,
          defaultValue_one: '{{count}} data source',
          defaultValue_other: '{{count}} data sources',
        })}
      </Text>
    </Stack>
  );
}
