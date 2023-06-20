// import React from 'react';
//
// import { Input } from '@grafana/ui';
//
// import { InfluxQuery } from '../../../../types';
//
// type Props = {
//   onChange: (query: InfluxQuery) => void;
//   onRunQuery: () => void;
//   query: InfluxQuery;
// };
//
// // Flight SQL Editor
// export const FSQLEditor = (props: Props) => {
//   const onSQLQueryChange = (query?: string) => {
//     if (query) {
//       props.onChange({ ...props.query, query, resultFormat: 'table' });
//     }
//     props.onRunQuery();
//   };
//   return (
//     <div>
//       <Input
//         value={props.query.query}
//         onBlur={(e) => onSQLQueryChange(e.currentTarget.value)}
//         onChange={(e) => onSQLQueryChange(e.currentTarget.value)}
//       />
//       <br />
//       <button onClick={() => onSQLQueryChange()}>run query</button>
//     </div>
//   );
// };

import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { InlineFormLabel, LinkButton, Themeable2, withTheme2 } from '@grafana/ui/src';

import { SQLQuery } from '../../../../../../../features/plugins/sql';
import { SqlQueryEditor } from '../../../../../../../features/plugins/sql/components/QueryEditor';
import InfluxDatasource from '../../../../datasource';
import { InfluxQuery } from '../../../../types';

import { FlightSQLDatasource } from './FlightSQLDatasource';

interface Props extends Themeable2 {
  onChange: (query: InfluxQuery) => void;
  onRunQuery: () => void;
  query: SQLQuery;
  datasource: InfluxDatasource;
}

class UnthemedSQLQueryEditor extends PureComponent<Props> {
  render() {
    const { query, theme, datasource, onRunQuery, onChange } = this.props;
    const styles = getStyles(theme);

    const flightSQLDatasource = new FlightSQLDatasource({
      url: datasource.urls[0],
      access: datasource.access,
      id: datasource.id,
      // So the datasource wants some connection stuff that doesn't apply to flightSQL? Ignoring for now.
      //@ts-ignore @todo fix PoC code
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

    const onSQLChange = (query: SQLQuery) => {
      // query => rawSql for now
      console.log('ON CHANGE', query);
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
        <SqlQueryEditor
          datasource={flightSQLDatasource}
          query={query}
          onRunQuery={onRunSQLQuery}
          onChange={onSQLChange}
        />
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
