import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { InlineFormLabel, LinkButton, Themeable2, withTheme2 } from '@grafana/ui/src';

import { SqlQueryEditor } from '../../../../../../../features/plugins/sql/components/QueryEditor';
import { FlightSQL } from '../../../../FlightSQL';
import InfluxDatasource from '../../../../datasource';
import { InfluxQuery } from '../../../../types';

interface Props extends Themeable2 {
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  query: InfluxQuery;
  datasource: InfluxDatasource;
}

function UnthemedSQLQueryEditor(props: Props) {
  const { query, theme, datasource, onRunQuery, onChange } = props;
  const styles = getStyles(theme);

  const sqlDatasource = new FlightSQL({
    url: datasource.urls[0],
    access: datasource.access,
    id: datasource.id,
    // So the datasource wants some connection stuff that doesn't apply to flightSQL? Igorning for now.
    //@ts-ignore
    jsonData: { ...datasource.jsonData, allowCleartextPasswords: false },
    meta: datasource.meta,
    name: datasource.name,
    readOnly: false,
    type: datasource.type,
    uid: datasource.uid,
  });

  const onRunSQLQuery = () => {
    console.log('RUN');
    return onRunQuery();
  };

  const onSQLChange = (query: InfluxQuery) => {
    console.log('query', query);
    return onChange(query);
  };

  const helpTooltip = (
    <div>
      Type: <i>ctrl+space</i> to show template variable suggestions <br />
      Many queries can be copied from Chronograf
    </div>
  );

  return (
    <>
      <SqlQueryEditor datasource={sqlDatasource} query={query} onRunQuery={onRunSQLQuery} onChange={onSQLChange} />
      <div className={cx('gf-form-inline', styles.editorActions)}>
        <LinkButton
          icon="external-link-alt"
          variant="secondary"
          target="blank"
          href="https://docs.influxdata.com/influxdb/latest/query-data/get-started/"
        >
          SQL language syntax (fix link)
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

export const SQLQueryEditor = withTheme2(UnthemedSQLQueryEditor);
