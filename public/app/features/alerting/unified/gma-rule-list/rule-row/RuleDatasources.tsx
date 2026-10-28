import { type DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, TextLink, Tooltip } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';

import { getDataSourceByUid } from '../../utils/datasource';
import { makeDataSourceLink } from '../../utils/misc';

interface RuleDatasourcesProps {
  datasourceUIDs: string[];
}

export function RuleDatasources({ datasourceUIDs }: RuleDatasourcesProps) {
  const dataSources = Array.from(new Set(datasourceUIDs))
    .map(getDataSourceByUid)
    .filter((ds): ds is DataSourceInstanceSettings => ds !== undefined);

  if (dataSources.length === 0) {
    return null;
  }

  const singleSource = dataSources.length === 1;
  const firstSource = dataSources[0];

  const label = singleSource
    ? firstSource.name
    : t('alerting.gma-rule-list.datasources', '{{numSources}} data sources', {
        numSources: dataSources.length,
      });

  return (
    <Stack direction="row" alignItems="center" gap={0.5}>
      {singleSource ? (
        // Single source: the name link right next to the logo makes a tooltip redundant.
        <DataSourceLogo dataSource={firstSource} size={12} />
      ) : (
        dataSources.map((ds) => (
          <Tooltip key={ds.uid} content={ds.name}>
            <span>
              <DataSourceLogo dataSource={ds} size={12} />
            </span>
          </Tooltip>
        ))
      )}
      {singleSource ? (
        <TextLink variant="bodySmall" inline={false} color="primary" href={makeDataSourceLink(firstSource.uid)}>
          {label}
        </TextLink>
      ) : (
        <Text variant="bodySmall" color="primary">
          {label}
        </Text>
      )}
    </Stack>
  );
}
