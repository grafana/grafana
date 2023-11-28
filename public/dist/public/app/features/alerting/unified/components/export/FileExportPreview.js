import { css } from '@emotion/css';
import saveAs from 'file-saver';
import React, { useCallback, useMemo } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Button, ClipboardButton, CodeEditor, useStyles2 } from '@grafana/ui';
import { allGrafanaExportProviders } from './providers';
export function FileExportPreview({ format, textDefinition, downloadFileName, onClose }) {
    const styles = useStyles2(fileExportPreviewStyles);
    const onDownload = useCallback(() => {
        const blob = new Blob([textDefinition], {
            type: `application/${format};charset=utf-8`,
        });
        saveAs(blob, `${downloadFileName}.${format}`);
        onClose();
    }, [textDefinition, downloadFileName, format, onClose]);
    const formattedTextDefinition = useMemo(() => {
        const provider = allGrafanaExportProviders[format];
        return provider.formatter ? provider.formatter(textDefinition) : textDefinition;
    }, [format, textDefinition]);
    return (
    // TODO Handle empty content
    React.createElement("div", { className: styles.container },
        React.createElement("div", { className: styles.content },
            React.createElement(AutoSizer, { disableWidth: true }, ({ height }) => (React.createElement(CodeEditor, { width: "100%", height: height, language: format, value: formattedTextDefinition, monacoOptions: {
                    minimap: {
                        enabled: false,
                    },
                    lineNumbers: 'on',
                    readOnly: true,
                } })))),
        React.createElement("div", { className: styles.actions },
            React.createElement(Button, { variant: "secondary", onClick: onClose }, "Cancel"),
            React.createElement(ClipboardButton, { icon: "copy", getText: () => textDefinition }, "Copy code"),
            React.createElement(Button, { icon: "download-alt", onClick: onDownload }, "Download"))));
}
const fileExportPreviewStyles = (theme) => ({
    container: css `
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: ${theme.spacing(2)};
  `,
    content: css `
    flex: 1 1 100%;
  `,
    actions: css `
    flex: 0;
    justify-content: flex-end;
    display: flex;
    gap: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=FileExportPreview.js.map