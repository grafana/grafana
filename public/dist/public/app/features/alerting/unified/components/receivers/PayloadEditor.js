import { css } from '@emotion/css';
import React, { useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Badge, Button, CodeEditor, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { AlertInstanceModalSelector } from './AlertInstanceModalSelector';
import { AlertTemplatePreviewData } from './TemplateData';
import { TemplateDataTable } from './TemplateDataDocs';
import { GenerateAlertDataModal } from './form/GenerateAlertDataModal';
export const RESET_TO_DEFAULT = 'Reset to default';
export function PayloadEditor({ payload, setPayload, defaultPayload, setPayloadFormatError, payloadFormatError, onPayloadError, }) {
    const styles = useStyles2(getStyles);
    const onReset = () => {
        setPayload(defaultPayload);
    };
    const [isEditingAlertData, setIsEditingAlertData] = useState(false);
    const onCloseEditAlertModal = () => {
        setIsEditingAlertData(false);
    };
    const errorInPayloadJson = payloadFormatError !== null;
    const validatePayload = () => {
        try {
            const payloadObj = JSON.parse(payload);
            JSON.stringify([...payloadObj]); // check if it's iterable, in order to be able to add more data
            setPayloadFormatError(null);
        }
        catch (e) {
            setPayloadFormatError(e instanceof Error ? e.message : 'Invalid JSON.');
            onPayloadError();
            throw e;
        }
    };
    const onOpenEditAlertModal = () => {
        try {
            validatePayload();
            setIsEditingAlertData(true);
        }
        catch (e) { }
    };
    const onOpenAlertSelectorModal = () => {
        try {
            validatePayload();
            setIsAlertSelectorOpen(true);
        }
        catch (e) { }
    };
    const onAddAlertList = (alerts) => {
        onCloseEditAlertModal();
        setIsAlertSelectorOpen(false);
        setPayload((payload) => {
            const payloadObj = JSON.parse(payload);
            return JSON.stringify([...payloadObj, ...alerts], undefined, 2);
        });
    };
    const [isAlertSelectorOpen, setIsAlertSelectorOpen] = useState(false);
    return (React.createElement("div", { className: styles.wrapper },
        React.createElement("div", { className: styles.editor },
            React.createElement("div", { className: styles.title },
                "Payload data",
                React.createElement(Tooltip, { placement: "top", content: React.createElement(AlertTemplateDataTable, null), theme: "info" },
                    React.createElement(Icon, { name: "info-circle", className: styles.tooltip, size: "xl" }))),
            React.createElement(AutoSizer, { disableHeight: true }, ({ width }) => (React.createElement("div", { className: styles.editorWrapper },
                React.createElement(CodeEditor, { width: width, height: 362, language: 'json', showLineNumbers: true, showMiniMap: false, value: payload, readOnly: false, onBlur: setPayload })))),
            React.createElement("div", { className: styles.buttonsWrapper },
                React.createElement(Button, { type: "button", variant: "secondary", className: styles.button, icon: "bell", disabled: errorInPayloadJson, onClick: onOpenAlertSelectorModal }, "Select alert instances"),
                React.createElement(Button, { onClick: onOpenEditAlertModal, className: styles.button, icon: "plus-circle", type: "button", variant: "secondary", disabled: errorInPayloadJson }, "Add custom alerts"),
                React.createElement(Button, { onClick: onReset, className: styles.button, icon: "arrow-up", type: "button", variant: "destructive" }, RESET_TO_DEFAULT),
                payloadFormatError !== null && (React.createElement(Badge, { color: "orange", icon: "exclamation-triangle", text: 'JSON Error', tooltip: 'Fix errors in payload, and click Refresh preview button' })))),
        React.createElement(GenerateAlertDataModal, { isOpen: isEditingAlertData, onDismiss: onCloseEditAlertModal, onAccept: onAddAlertList }),
        React.createElement(AlertInstanceModalSelector, { onSelect: onAddAlertList, isOpen: isAlertSelectorOpen, onClose: () => setIsAlertSelectorOpen(false) })));
}
const AlertTemplateDataTable = () => {
    const styles = useStyles2(getStyles);
    return (React.createElement(TemplateDataTable, { caption: React.createElement("h4", { className: styles.templateDataDocsHeader },
            "Alert template data ",
            React.createElement("span", null, "This is the list of alert data fields used in the preview.")), dataItems: AlertTemplatePreviewData }));
};
const getStyles = (theme) => ({
    jsonEditor: css `
    width: 100%;
    height: 100%;
  `,
    buttonsWrapper: css `
    margin-top: ${theme.spacing(1)};
    display: flex;
    flex-wrap: wrap;
  `,
    button: css `
    flex: none;
    width: fit-content;
    padding-right: ${theme.spacing(1)};
    margin-right: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(1)};
  `,
    title: css `
    font-weight: ${theme.typography.fontWeightBold};
    heigth: 41px;
    padding-top: 10px;
    padding-left: ${theme.spacing(2)};
    margin-top: 19px;
  `,
    wrapper: css `
    flex: 1;
    min-width: 450px;
  `,
    tooltip: css `
    padding-left: ${theme.spacing(1)};
  `,
    editorWrapper: css `
    width: min-content;
    padding-top: 7px;
  `,
    editor: css `
    display: flex;
    flex-direction: column;
    margin-top: ${theme.spacing(-1)};
  `,
    templateDataDocsHeader: css `
    color: ${theme.colors.text.primary};

    span {
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
    }
  `,
});
//# sourceMappingURL=PayloadEditor.js.map