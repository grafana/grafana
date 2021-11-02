import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useState, useMemo } from 'react';
import { Modal, TabContent, TabsBar, Tab, Button, useStyles } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';
import { css } from '@emotion/css';
import { RuleSettingsEditor } from './RuleSettingsEditor';
import { getPipeLineEntities } from './utils';
import { RuleSettingsArray } from './RuleSettingsArray';
import { RuleTest } from './RuleTest';
var tabs = [
    { label: 'Converter', type: 'converter', isConverter: true },
    { label: 'Processors', type: 'frameProcessors' },
    { label: 'Outputs', type: 'frameOutputs' },
    { label: 'Test', isTest: true, icon: 'flask' },
];
export var RuleModal = function (props) {
    var _a;
    var isOpen = props.isOpen, onClose = props.onClose, clickColumn = props.clickColumn;
    var _b = __read(useState(props.rule), 2), rule = _b[0], setRule = _b[1];
    var _c = __read(useState(tabs.find(function (t) { return t.type === clickColumn; })), 2), activeTab = _c[0], setActiveTab = _c[1];
    // to show color of Save button
    var _d = __read(useState(false), 2), hasChange = _d[0], setChange = _d[1];
    var _e = __read(useState((activeTab === null || activeTab === void 0 ? void 0 : activeTab.type) ? (_a = rule === null || rule === void 0 ? void 0 : rule.settings) === null || _a === void 0 ? void 0 : _a[activeTab.type] : undefined), 2), ruleSetting = _e[0], setRuleSetting = _e[1];
    var _f = __read(useState(), 2), entitiesInfo = _f[0], setEntitiesInfo = _f[1];
    var styles = useStyles(getStyles);
    var onRuleSettingChange = function (value) {
        var _a;
        setChange(true);
        if (activeTab === null || activeTab === void 0 ? void 0 : activeTab.type) {
            setRule(__assign(__assign({}, rule), { settings: __assign(__assign({}, rule.settings), (_a = {}, _a[activeTab === null || activeTab === void 0 ? void 0 : activeTab.type] = value, _a)) }));
        }
        setRuleSetting(value);
    };
    // load pipeline entities info
    useMemo(function () {
        getPipeLineEntities().then(function (data) {
            setEntitiesInfo(data);
        });
    }, []);
    var onSave = function () {
        getBackendSrv()
            .put("api/live/channel-rules", rule)
            .then(function () {
            setChange(false);
            onClose();
        })
            .catch(function (e) { return console.error(e); });
    };
    return (React.createElement(Modal, { isOpen: isOpen, title: rule.pattern, onDismiss: onClose, closeOnEscape: true },
        React.createElement(TabsBar, null, tabs.map(function (tab, index) {
            return (React.createElement(Tab, { key: index, label: tab.label, active: tab === activeTab, icon: tab.icon, onChangeTab: function () {
                    var _a;
                    setActiveTab(tab);
                    if (tab.type) {
                        // to notify children of the new rule
                        setRuleSetting((_a = rule === null || rule === void 0 ? void 0 : rule.settings) === null || _a === void 0 ? void 0 : _a[tab.type]);
                    }
                } }));
        })),
        React.createElement(TabContent, null,
            entitiesInfo && rule && activeTab && (React.createElement(React.Fragment, null,
                (activeTab === null || activeTab === void 0 ? void 0 : activeTab.isTest) && React.createElement(RuleTest, { rule: rule }),
                activeTab.isConverter && (React.createElement(RuleSettingsEditor, { onChange: onRuleSettingChange, value: ruleSetting, ruleType: 'converter', entitiesInfo: entitiesInfo })),
                !activeTab.isConverter && activeTab.type && (React.createElement(RuleSettingsArray, { onChange: onRuleSettingChange, value: ruleSetting, ruleType: activeTab.type, entitiesInfo: entitiesInfo })))),
            React.createElement(Button, { onClick: onSave, className: styles.save, variant: hasChange ? 'primary' : 'secondary' }, "Save"))));
};
var getStyles = function (theme) {
    return {
        save: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-top: 5px;\n    "], ["\n      margin-top: 5px;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=RuleModal.js.map