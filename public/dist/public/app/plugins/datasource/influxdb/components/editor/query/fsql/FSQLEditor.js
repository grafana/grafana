import { css, cx } from '@emotion/css';
import React, { PureComponent } from 'react';
import { Alert, InlineFormLabel, LinkButton, withTheme2 } from '@grafana/ui/src';
import { SqlQueryEditor } from '../../../../../../../features/plugins/sql/components/QueryEditor';
import { applyQueryDefaults } from '../../../../../../../features/plugins/sql/defaults';
import { FlightSQLDatasource } from '../../../../fsql/datasource.flightsql';
class UnthemedSQLQueryEditor extends PureComponent {
    constructor(props) {
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
    transformQuery(query) {
        const defaultQuery = applyQueryDefaults(query);
        return Object.assign(Object.assign({}, defaultQuery), { sql: Object.assign(Object.assign({}, defaultQuery.sql), { limit: undefined }) });
    }
    render() {
        const { query, theme, onRunQuery, onChange } = this.props;
        const styles = getStyles(theme);
        const onRunSQLQuery = () => {
            return onRunQuery();
        };
        const onSQLChange = (query) => {
            // query => rawSql for now
            onChange(Object.assign({}, query));
        };
        const helpTooltip = (React.createElement("div", null,
            "Type: ",
            React.createElement("i", null, "ctrl+space"),
            " to show template variable suggestions ",
            React.createElement("br", null),
            "Many queries can be copied from Chronograf"));
        return (React.createElement(React.Fragment, null,
            React.createElement(Alert, { title: "Warning", severity: "warning" }, "InfluxDB SQL support is currently in alpha state. It does not have all the features."),
            React.createElement(SqlQueryEditor, { datasource: this.datasource, query: this.transformQuery(query), onRunQuery: onRunSQLQuery, onChange: onSQLChange }),
            React.createElement("div", { className: cx('gf-form-inline', styles.editorActions) },
                React.createElement(LinkButton, { icon: "external-link-alt", variant: "secondary", target: "blank", href: "https://docs.influxdata.com/influxdb/cloud-serverless/query-data/sql/" }, "SQL language syntax"),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label gf-form-label--grow" })),
                React.createElement(InlineFormLabel, { width: 5, tooltip: helpTooltip }, "Help"))));
    }
}
const getStyles = (theme) => ({
    editorContainerStyles: css `
    height: 200px;
    max-width: 100%;
    resize: vertical;
    overflow: auto;
    background-color: ${theme.isDark ? theme.colors.background.canvas : theme.colors.background.primary};
    padding-bottom: ${theme.spacing(1)};
  `,
    editorActions: css `
    margin-top: 6px;
  `,
});
export const FSQLEditor = withTheme2(UnthemedSQLQueryEditor);
//# sourceMappingURL=FSQLEditor.js.map