import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Button, FileDropzone, HorizontalGroup, InlineField, InlineFieldRow, Modal, QueryField, RadioButtonGroup, useStyles2, useTheme2, } from '@grafana/ui';
import { SearchForm } from './SearchForm';
export function QueryEditor({ datasource, query, onChange, onRunQuery }) {
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const onChangeQuery = (value) => {
        const nextQuery = Object.assign(Object.assign({}, query), { query: value });
        onChange(nextQuery);
    };
    const renderEditorBody = () => {
        switch (query.queryType) {
            case 'search':
                return React.createElement(SearchForm, { datasource: datasource, query: query, onChange: onChange });
            default:
                return (React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: "Trace ID", labelWidth: 14, grow: true },
                        React.createElement(QueryField, { query: query.query, onChange: onChangeQuery, onRunQuery: onRunQuery, placeholder: 'Enter a Trace ID (run with Shift+Enter)', portalOrigin: "jaeger" }))));
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Modal, { title: 'Upload trace', isOpen: uploadModalOpen, onDismiss: () => setUploadModalOpen(false) },
            React.createElement("div", { className: css({ padding: theme.spacing(2) }) },
                React.createElement(FileDropzone, { options: { multiple: false }, onLoad: (result) => {
                        datasource.uploadedJson = result;
                        onChange(Object.assign(Object.assign({}, query), { queryType: 'upload' }));
                        setUploadModalOpen(false);
                        onRunQuery();
                    } }))),
        React.createElement("div", { className: styles.container },
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Query type", grow: true },
                    React.createElement(HorizontalGroup, { spacing: 'sm', align: 'center', justify: 'space-between' },
                        React.createElement(RadioButtonGroup, { options: [
                                { value: 'search', label: 'Search' },
                                { value: undefined, label: 'TraceID' },
                            ], value: query.queryType, onChange: (v) => onChange(Object.assign(Object.assign({}, query), { queryType: v })), size: "md" }),
                        React.createElement(Button, { variant: "secondary", size: "sm", onClick: () => {
                                setUploadModalOpen(true);
                            } }, "Import trace")))),
            renderEditorBody())));
}
const getStyles = () => ({
    container: css `
    width: 100%;
  `,
});
//# sourceMappingURL=QueryEditor.js.map