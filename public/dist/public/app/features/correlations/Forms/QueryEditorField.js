import { __awaiter } from "tslib";
import React from 'react';
import { Controller } from 'react-hook-form';
import { useAsync } from 'react-use';
import { CoreApp } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { Field, LoadingPlaceholder, Alert } from '@grafana/ui';
export const QueryEditorField = ({ dsUid, invalid, error, name }) => {
    var _a;
    const { value: datasource, loading: dsLoading, error: dsError, } = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        if (!dsUid) {
            return;
        }
        return getDataSourceSrv().get(dsUid);
    }), [dsUid]);
    const QueryEditor = (_a = datasource === null || datasource === void 0 ? void 0 : datasource.components) === null || _a === void 0 ? void 0 : _a.QueryEditor;
    return (React.createElement(Field, { label: "Query", description: React.createElement("span", null,
            "Define the query that is run when the link is clicked. You can use",
            ' ',
            React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/panels-visualizations/configure-data-links/", target: "_blank", rel: "noreferrer" }, "variables"),
            ' ',
            "to access specific field values."), invalid: invalid, error: error },
        React.createElement(Controller, { name: name, rules: {
                validate: {
                    hasQueryEditor: () => QueryEditor !== undefined || 'The selected target data source must export a query editor.',
                },
            }, render: ({ field: { value, onChange } }) => {
                if (dsLoading) {
                    return React.createElement(LoadingPlaceholder, { text: "Loading query editor..." });
                }
                if (dsError) {
                    return React.createElement(Alert, { title: "Error loading data source" }, "The selected data source could not be loaded.");
                }
                if (!datasource) {
                    return (React.createElement(Alert, { title: "No data source selected", severity: "info" }, "Please select a target data source first."));
                }
                if (!QueryEditor) {
                    return React.createElement(Alert, { title: "Data source does not export a query editor." });
                }
                return (React.createElement(React.Fragment, null,
                    React.createElement(QueryEditor, { onRunQuery: () => { }, app: CoreApp.Correlations, onChange: (value) => {
                            onChange(value);
                        }, datasource: datasource, query: value })));
            } })));
};
//# sourceMappingURL=QueryEditorField.js.map