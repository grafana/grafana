import { css } from '@emotion/css';
import { defaults } from 'lodash';
import React from 'react';
import { InlineLabel, useStyles2 } from '@grafana/ui';
import { defaultQuery } from '../types';
import { TempoQueryBuilderOptions } from './TempoQueryBuilderOptions';
import { TraceQLEditor } from './TraceQLEditor';
export function QueryEditor(props) {
    const styles = useStyles2(getStyles);
    const query = defaults(props.query, defaultQuery);
    const onEditorChange = (value) => {
        props.onChange(Object.assign(Object.assign({}, query), { query: value }));
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineLabel, null,
            "Build complex queries using TraceQL to select a list of traces.",
            ' ',
            React.createElement("a", { rel: "noreferrer", target: "_blank", href: "https://grafana.com/docs/tempo/latest/traceql/" }, "Documentation")),
        React.createElement(TraceQLEditor, { placeholder: "Enter a TraceQL query or trace ID (run with Shift+Enter)", value: query.query || '', onChange: onEditorChange, datasource: props.datasource, onRunQuery: props.onRunQuery }),
        React.createElement("div", { className: styles.optionsContainer },
            React.createElement(TempoQueryBuilderOptions, { query: query, onChange: props.onChange }))));
}
const getStyles = () => ({
    optionsContainer: css `
    margin-top: 10px;
  `,
});
//# sourceMappingURL=QueryEditor.js.map