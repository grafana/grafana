import { memo, useMemo } from 'react';

import { type SQLQuery, SqlQueryEditorLazy, applyQueryDefaults } from '@grafana/sql';
import { InlineFormLabel, LinkButton, Stack, Space } from '@grafana/ui';

import type InfluxDatasource from '../../../../datasource';
import { FlightSQLDatasource } from '../../../../fsql/datasource.flightsql';
import { type InfluxQuery } from '../../../../types';

interface Props {
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  query: InfluxQuery;
  datasource: InfluxDatasource;
}

export const FSQLEditor = memo(function FSQLEditor({
  query,
  onRunQuery,
  onChange,
  datasource: influxDatasource,
}: Props) {
  const datasource = useMemo(
    () =>
      new FlightSQLDatasource(
        {
          url: influxDatasource.urls[0],
          access: influxDatasource.access,

          jsonData: {
            // TODO Clean this
            allowCleartextPasswords: false,
            tlsAuth: false,
            tlsAuthWithCACert: false,
            tlsSkipVerify: false,
            maxIdleConns: 1,
            maxOpenConns: 1,
            maxIdleConnsAuto: true,
            connMaxLifetime: 1,
            timezone: '',
            user: '',
            database: '',
            url: influxDatasource.urls[0],
            timeInterval: '',
          },
          meta: influxDatasource.meta,
          name: influxDatasource.name,
          readOnly: false,
          type: influxDatasource.type,
          uid: influxDatasource.uid,
        },
        influxDatasource.templateSrv
      ),
    [influxDatasource]
  );

  function transformQuery(q: InfluxQuery & SQLQuery): SQLQuery {
    const defaultQuery = applyQueryDefaults(q);
    return {
      ...defaultQuery,
      dataset: 'iox',
      sql: {
        ...defaultQuery.sql,
        limit: undefined,
      },
    };
  }

  const helpTooltip = (
    <div>
      Type: <i>ctrl+space</i> to show template variable suggestions <br />
      Many queries can be copied from Chronograf
    </div>
  );

  return (
    <>
      <SqlQueryEditorLazy
        datasource={datasource}
        query={transformQuery(query)}
        onRunQuery={onRunQuery}
        onChange={(q: SQLQuery) => onChange({ ...q })} // query => rawSql for now
        queryHeaderProps={{ dialect: 'influx' }}
      />
      <Space v={0.5} />
      <Stack flex={1} gap={4} justifyContent="space-between">
        <LinkButton
          icon="external-link-alt"
          variant="secondary"
          target="blank"
          href="https://docs.influxdata.com/influxdb/cloud-serverless/query-data/sql/"
        >
          SQL language syntax
        </LinkButton>

        <InlineFormLabel width={5} tooltip={helpTooltip}>
          Help
        </InlineFormLabel>
      </Stack>
    </>
  );
});
