import { css } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { useStyles2 } from '@grafana/ui';
import { HoverCard } from '../HoverCard';
import { AlertTemplateData, GlobalTemplateData, KeyValueCodeSnippet, KeyValueTemplateFunctions, } from './TemplateData';
export function TemplateDataDocs() {
    const styles = useStyles2(getTemplateDataDocsStyles);
    const AlertTemplateDataTable = (React.createElement(TemplateDataTable, { caption: React.createElement("h4", { className: styles.header },
            "Alert template data ",
            React.createElement("span", null, "Available only when in the context of an Alert (e.g. inside .Alerts loop)")), dataItems: AlertTemplateData }));
    return (React.createElement(Stack, { gap: 2, flexGrow: 1 },
        React.createElement(TemplateDataTable, { caption: React.createElement("h4", { className: styles.header }, "Template Data"), dataItems: GlobalTemplateData, typeRenderer: (type) => type === '[]Alert' ? (React.createElement(HoverCard, { content: AlertTemplateDataTable },
                React.createElement("div", { className: styles.interactiveType }, type))) : type === 'KeyValue' ? (React.createElement(HoverCard, { content: React.createElement(KeyValueTemplateDataTable, null) },
                React.createElement("div", { className: styles.interactiveType }, type))) : (type) })));
}
const getTemplateDataDocsStyles = (theme) => ({
    header: css `
    color: ${theme.colors.text.primary};

    span {
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
    }
  `,
    interactiveType: css `
    color: ${theme.colors.text.link};
  `,
});
export function TemplateDataTable({ dataItems, caption, typeRenderer }) {
    const styles = useStyles2(getTemplateDataTableStyles);
    return (React.createElement("table", { className: styles.table },
        React.createElement("caption", null, caption),
        React.createElement("thead", null,
            React.createElement("tr", null,
                React.createElement("th", null, "Name"),
                React.createElement("th", null, "Type"),
                React.createElement("th", null, "Notes"))),
        React.createElement("tbody", null, dataItems.map(({ name, type, notes }, index) => (React.createElement("tr", { key: index },
            React.createElement("td", null, name),
            React.createElement("td", null, typeRenderer ? typeRenderer(type) : type),
            React.createElement("td", null, notes)))))));
}
function KeyValueTemplateDataTable() {
    const tableStyles = useStyles2(getTemplateDataTableStyles);
    return (React.createElement("div", null,
        "KeyValue is a set of key/value string pairs that represent labels and annotations.",
        React.createElement("pre", null,
            React.createElement("code", null, KeyValueCodeSnippet)),
        React.createElement("table", { className: tableStyles.table },
            React.createElement("caption", null, "Key-value methods"),
            React.createElement("thead", null,
                React.createElement("tr", null,
                    React.createElement("th", null, "Name"),
                    React.createElement("th", null, "Arguments"),
                    React.createElement("th", null, "Returns"),
                    React.createElement("th", null, "Notes"))),
            React.createElement("tbody", null, KeyValueTemplateFunctions.map(({ name, args, returns, notes }) => (React.createElement("tr", { key: name },
                React.createElement("td", null, name),
                React.createElement("td", null, args),
                React.createElement("td", null, returns),
                React.createElement("td", null, notes))))))));
}
const getTemplateDataTableStyles = (theme) => ({
    table: css `
    border-collapse: collapse;
    width: 100%;

    caption {
      caption-side: top;
    }

    td,
    th {
      padding: ${theme.spacing(1, 1)};
    }

    thead {
      font-weight: ${theme.typography.fontWeightBold};
    }

    tbody tr:nth-child(2n + 1) {
      background-color: ${theme.colors.background.secondary};
    }

    tbody td:nth-child(1) {
      font-weight: ${theme.typography.fontWeightBold};
    }

    tbody td:nth-child(2) {
      font-style: italic;
    }
  `,
});
//# sourceMappingURL=TemplateDataDocs.js.map