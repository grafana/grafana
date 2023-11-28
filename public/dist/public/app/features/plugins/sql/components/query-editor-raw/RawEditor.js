import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useMeasure } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { reportInteraction } from '@grafana/runtime';
import { Modal, useStyles2, useTheme2 } from '@grafana/ui';
import { QueryEditorRaw } from './QueryEditorRaw';
import { QueryToolbox } from './QueryToolbox';
export function RawEditor({ db, query, onChange, onRunQuery, onValidate, queryToValidate, range }) {
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const [isExpanded, setIsExpanded] = useState(false);
    const [toolboxRef, toolboxMeasure] = useMeasure();
    const [editorRef, editorMeasure] = useMeasure();
    const editorLanguageDefinition = useMemo(() => db.getEditorLanguageDefinition(), [db]);
    const renderQueryEditor = (width, height) => {
        return (React.createElement(QueryEditorRaw, { editorLanguageDefinition: editorLanguageDefinition, query: query, width: width, height: height ? height - toolboxMeasure.height : undefined, onChange: onChange }, ({ formatQuery }) => {
            return (React.createElement("div", { ref: toolboxRef },
                React.createElement(QueryToolbox, { db: db, query: queryToValidate, onValidate: onValidate, onFormatCode: formatQuery, showTools: true, range: range, onExpand: setIsExpanded, isExpanded: isExpanded })));
        }));
    };
    const renderEditor = (standalone = false) => {
        return standalone ? (React.createElement(AutoSizer, null, ({ width, height }) => {
            return renderQueryEditor(width, height);
        })) : (React.createElement("div", { ref: editorRef }, renderQueryEditor()));
    };
    const renderPlaceholder = () => {
        return (React.createElement("div", { style: {
                width: editorMeasure.width,
                height: editorMeasure.height,
                background: theme.colors.background.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            } }, "Editing in expanded code editor"));
    };
    return (React.createElement(React.Fragment, null,
        isExpanded ? renderPlaceholder() : renderEditor(),
        isExpanded && (React.createElement(Modal, { title: `Query ${query.refId}`, closeOnBackdropClick: false, closeOnEscape: false, className: styles.modal, contentClassName: styles.modalContent, isOpen: isExpanded, onDismiss: () => {
                var _a;
                reportInteraction('grafana_sql_editor_expand', {
                    datasource: (_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type,
                    expanded: false,
                });
                setIsExpanded(false);
            } }, renderEditor(true)))));
}
function getStyles(theme) {
    return {
        modal: css `
      width: 95vw;
      height: 95vh;
    `,
        modalContent: css `
      height: 100%;
      padding-top: 0;
    `,
    };
}
//# sourceMappingURL=RawEditor.js.map