import { PureComponent } from 'react';

import { SQLQuery, SqlQueryEditorLazy, applyQueryDefaults } from '@grafana/sql';
import { InlineFormLabel, LinkButton, Themeable2, withTheme2, Stack, Space } from '@grafana/ui';

import InfluxDatasource from '../../../../datasource';
import { FlightSQLDatasource } from '../../../../fsql/datasource.flightsql';
import { InfluxQuery } from '../../../../types';

interface Props extends Themeable2 {
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  query: InfluxQuery;
  datasource: InfluxDatasource;
}

class UnthemedSQLQueryEditor extends PureComponent<Props> {
  datasource: FlightSQLDatasource;

  constructor(props: Props) {
    super(props);
    const { datasource: influxDatasource } = props;

    this.datasource = new FlightSQLDatasource(
      {
        url: influxDatasource.urls[0],
        access: influxDatasource.access,
        id: influxDatasource.id,

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
    );
  }

  transformQuery(query: InfluxQuery & SQLQuery): SQLQuery {
    const defaultQuery = applyQueryDefaults(query);
    return {
      ...defaultQuery,
      dataset: 'iox',
      sql: {
        ...defaultQuery.sql,
        limit: undefined,
      },
    };
  }

  render() {
    const { query, onRunQuery, onChange } = this.props;

    const onRunSQLQuery = () => {
      return onRunQuery();
    };

    const onSQLChange = (query: SQLQuery) => {
      // query => rawSql for now
      onChange({ ...query });
    };

    const helpTooltip = (
      <div>
        Type: <i>ctrl+space</i> to show template variable suggestions <br />
        Many queries can be copied from Chronograf
      </div>
    );

    return (
      <>
        <SqlQueryEditorLazy
          datasource={this.datasource}
          query={this.transformQuery(query)}
          onRunQuery={onRunSQLQuery}
          onChange={onSQLChange}
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
  }
}

export const FSQLEditor = withTheme2(UnthemedSQLQueryEditor);
