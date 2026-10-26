import { css, cx } from '@emotion/css';
import { forwardRef } from 'react';

import { type DataSourceInstanceSettings, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';

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
        <DataSourceLogo dataSource={firstSource} />
      ) : (
        dataSources.map((ds) => (
          <Tooltip key={ds.uid} content={ds.name}>
            <DataSourceLogo dataSource={ds} />
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

/** Datasource logo image; exported for use in other row metadata components. */
export const DataSourceLogo = forwardRef<HTMLImageElement, { dataSource: DataSourceInstanceSettings }>(
  ({ dataSource }, ref) => {
    const styles = useStyles2(getLogoStyles);
    return (
      <img
        ref={ref}
        className={cx(styles.logo, { [styles.filter]: dataSource.meta.builtIn })}
        alt={`${dataSource.meta.name} logo`}
        src={dataSource.meta.info.logos.small}
      />
    );
  }
);
DataSourceLogo.displayName = 'DataSourceLogo';

const getLogoStyles = (theme: GrafanaTheme2) => ({
  logo: css({
    height: '12px',
    width: '12px',
    borderRadius: theme.shape.radius.default,
  }),
  filter: css({
    filter: theme.isDark ? 'invert(1) brightness(2)' : 'none',
  }),
});
