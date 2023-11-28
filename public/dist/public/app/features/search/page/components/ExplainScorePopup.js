import React, { useState } from 'react';
import { CodeEditor, Modal, ModalTabsHeader, TabContent } from '@grafana/ui';
import { DataHoverView } from 'app/features/visualization/data-hover/DataHoverView';
const tabs = [
    { label: 'Score', value: 'score' },
    { label: 'Fields', value: 'fields' },
    { label: 'Allowed actions', value: 'allowed_actions' },
];
export function ExplainScorePopup({ name, explain, frame, row }) {
    const [isOpen, setOpen] = useState(true);
    const [activeTab, setActiveTab] = useState('score');
    const modalHeader = (React.createElement(ModalTabsHeader, { title: name, icon: 'info', tabs: tabs, activeTab: activeTab, onChangeTab: (t) => {
            setActiveTab(t.value);
        } }));
    return (React.createElement(Modal, { title: modalHeader, isOpen: isOpen, onDismiss: () => setOpen(false), closeOnBackdropClick: true, closeOnEscape: true },
        React.createElement(TabContent, null,
            activeTab === tabs[0].value && (React.createElement(CodeEditor, { width: "100%", height: "70vh", language: "json", showLineNumbers: false, showMiniMap: true, value: JSON.stringify(explain, null, 2), readOnly: false })),
            activeTab === tabs[1].value && (React.createElement("div", null,
                React.createElement(DataHoverView, { data: frame, rowIndex: row }))),
            activeTab === tabs[2].value && (React.createElement(CodeEditor, { width: "100%", height: "70vh", language: "json", showLineNumbers: false, showMiniMap: false, value: (() => {
                    var _a, _b, _c, _d;
                    const allowedActions = (_b = (_a = frame.fields.find((f) => f.name === 'allowed_actions')) === null || _a === void 0 ? void 0 : _a.values) === null || _b === void 0 ? void 0 : _b[row];
                    const dsUids = (_d = (_c = frame.fields.find((f) => f.name === 'ds_uid')) === null || _c === void 0 ? void 0 : _c.values) === null || _d === void 0 ? void 0 : _d[row];
                    return JSON.stringify({ dsUids: dsUids !== null && dsUids !== void 0 ? dsUids : [], allowedActions: allowedActions !== null && allowedActions !== void 0 ? allowedActions : [] }, null, 2);
                })(), readOnly: false })))));
}
//# sourceMappingURL=ExplainScorePopup.js.map