import { t } from '@grafana/i18n';
import { Stack, Text, TextLink } from '@grafana/ui';
import { DataSourceLogo } from 'app/features/datasources/components/picker/DataSourceLogo';

import { getDataSourceByUid } from '../../utils/datasource';
import { makeDataSourceLink } from '../../utils/misc';

interface RuleRecordedMetricProps {
  metric: string;
  targetDatasourceUID: string;
}

export function RuleRecordedMetric({ metric, targetDatasourceUID }: RuleRecordedMetricProps) {
  const dataSource = getDataSourceByUid(targetDatasourceUID);

  return (
    <Stack direction="row" alignItems="center" gap={0.5} wrap={false}>
      <Text variant="bodySmall" color="secondary">
        {t('alerting.gma-rule-list.recorded-metric.records', 'Records')}
      </Text>
      <Text variant="bodySmall" color="primary">
        {metric}
      </Text>
      <Text variant="bodySmall" color="secondary">
        {t('alerting.gma-rule-list.recorded-metric.to', 'to')}
      </Text>
      {dataSource ? (
        <>
          <DataSourceLogo dataSource={dataSource} />
          <TextLink variant="bodySmall" inline={false} color="primary" href={makeDataSourceLink(targetDatasourceUID)}>
            {dataSource.name}
          </TextLink>
        </>
      ) : (
        <Text variant="bodySmall" color="primary">
          {targetDatasourceUID}
        </Text>
      )}
    </Stack>
  );
}
