import React, { PureComponent } from 'react';
import { InlineFormLabel, TextArea } from '@grafana/ui/src';
import { InfluxVersion } from '../../../types';
import { FluxQueryEditor } from '../query/flux/FluxQueryEditor';
export default class VariableQueryEditor extends PureComponent {
    constructor() {
        super(...arguments);
        this.onRefresh = () => {
            // noop
        };
    }
    render() {
        let { query, datasource, onChange } = this.props;
        switch (datasource.version) {
            case InfluxVersion.Flux:
                return (React.createElement(FluxQueryEditor, { datasource: datasource, query: {
                        refId: 'A',
                        query,
                    }, onRunQuery: this.onRefresh, onChange: (v) => onChange(v.query) }));
            //@todo add support for SQL
            case InfluxVersion.SQL:
                return React.createElement("div", { className: "gf-form-inline" }, "TODO");
            // Influx/default case
            case InfluxVersion.InfluxQL:
            default:
                return (React.createElement("div", { className: "gf-form-inline" },
                    React.createElement(InlineFormLabel, { width: 10 }, "Query"),
                    React.createElement("div", { className: "gf-form-inline gf-form--grow" },
                        React.createElement(TextArea, { defaultValue: query || '', placeholder: "metric name or tags query", rows: 1, className: "gf-form-input", onBlur: (e) => onChange(e.currentTarget.value) }))));
        }
    }
}
//# sourceMappingURL=VariableQueryEditor.js.map