import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export default function CheatSheet() {
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h2", { id: "jaeger-cheat-sheet" }, "Jaeger Cheat Sheet"),
        React.createElement("p", null,
            "This cheat sheet provides a quick overview of the query types that are available. For more details about the Jaeger data source, check out",
            ' ',
            React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/datasources/jaeger", target: "_blank", rel: "noreferrer", className: styles.anchorTag }, "the documentation"),
            "."),
        React.createElement("hr", null),
        React.createElement("ul", { className: styles.unorderedList },
            React.createElement("li", null, "Search - filter traces by service name. Addtionally, you can filter by tags or min/max duration, as well as limit the number of traces that are returned."),
            React.createElement("li", null, "TraceID - if you have a trace ID, simply enter the trace ID to see the trace."),
            React.createElement("li", null,
                "JSON File - you can upload a JSON file that contains a single trace to visualize it. If the file has multiple traces then the first trace is used for visualization. An example of a valid JSON file can be found in",
                ' ',
                React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/datasources/jaeger/#upload-json-trace-file", target: "_blank", rel: "noreferrer", className: styles.anchorTag }, "this section"),
                ' ',
                "of the documentation."))));
}
const getStyles = (theme) => ({
    anchorTag: css `
    color: ${theme.colors.text.link};
  `,
    unorderedList: css `
    list-style-type: none;
  `,
});
//# sourceMappingURL=CheatSheet.js.map