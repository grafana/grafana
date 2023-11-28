import { css } from '@emotion/css';
import React from 'react';
import { useCopyToClipboard } from 'react-use';
import { reportInteraction } from '@grafana/runtime';
import { CodeEditor, Field, IconButton, useStyles2 } from '@grafana/ui';
import { formatSQL } from '../../utils/formatSQL';
export function Preview({ rawSql, datasourceType }) {
    // TODO: use zero index to give feedback about copy success
    const [_, copyToClipboard] = useCopyToClipboard();
    const styles = useStyles2(getStyles);
    const copyPreview = (rawSql) => {
        copyToClipboard(rawSql);
        reportInteraction('grafana_sql_preview_copied', {
            datasource: datasourceType,
        });
    };
    const labelElement = (React.createElement("div", { className: styles.labelWrapper },
        React.createElement("span", { className: styles.label }, "Preview"),
        React.createElement(IconButton, { tooltip: "Copy to clipboard", onClick: () => copyPreview(rawSql), name: "copy" })));
    return (React.createElement(Field, { label: labelElement, className: styles.grow },
        React.createElement(CodeEditor, { language: "sql", height: 80, value: formatSQL(rawSql), monacoOptions: { scrollbar: { vertical: 'hidden' }, scrollBeyondLastLine: false }, readOnly: true, showMiniMap: false })));
}
function getStyles(theme) {
    return {
        grow: css({ flexGrow: 1 }),
        label: css({ fontSize: 12, fontWeight: theme.typography.fontWeightMedium }),
        labelWrapper: css({ display: 'flex', justifyContent: 'space-between', paddingBottom: theme.spacing(0.5) }),
    };
}
//# sourceMappingURL=Preview.js.map