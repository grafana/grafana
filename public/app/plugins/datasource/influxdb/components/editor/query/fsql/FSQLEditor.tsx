import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Alert, InlineFormLabel, LinkButton, Themeable2, withTheme2 } from '@grafana/ui/src';

import { SQLQuery } from '../../../../../../../features/plugins/sql';
import { SqlQueryEditor } from '../../../../../../../features/plugins/sql/components/QueryEditor';
import InfluxDatasource from '../../../../datasource';
import { InfluxQuery } from '../../../../types';

import { FlightSQLDatasource } from './FlightSQLDatasource';

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

    this.datasource = new FlightSQLDatasource({
      url: influxDatasource.urls[0],
      access: influxDatasource.access,
      id: influxDatasource.id,

      jsonData: {
        // Not applicable to flightSQL? @itsmylife
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
    });
  }

  transformQuery(query: InfluxQuery & SQLQuery): SQLQuery {
    return {
      ...query,
    };
  }

  render() {
    const { query, theme, onRunQuery, onChange } = this.props;
    const styles = getStyles(theme);

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
        <Alert title="Warning" severity="warning">
          InfluxDB SQL support is currently in alpha state. It does not have all the features.
        </Alert>
        <SqlQueryEditor
          datasource={this.datasource}
          query={this.transformQuery(query)}
          onRunQuery={onRunSQLQuery}
          onChange={onSQLChange}
        />
        <div className={cx('gf-form-inline', styles.editorActions)}>
          <LinkButton
            icon="external-link-alt"
            variant="secondary"
            target="blank"
            href="https://docs.influxdata.com/influxdb/cloud-serverless/query-data/sql/"
          >
            SQL language syntax
          </LinkButton>
          <div className="gf-form gf-form--grow">
            <div className="gf-form-label gf-form-label--grow"></div>
          </div>
          <InlineFormLabel width={5} tooltip={helpTooltip}>
            Help
          </InlineFormLabel>
        </div>
      </>
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  editorContainerStyles: css`
    height: 200px;
    max-width: 100%;
    resize: vertical;
    overflow: auto;
    background-color: ${theme.isDark ? theme.colors.background.canvas : theme.colors.background.primary};
    padding-bottom: ${theme.spacing(1)};
  `,
  editorActions: css`
    margin-top: 6px;
  `,
});

export const FSQLEditor = withTheme2(UnthemedSQLQueryEditor);
