import { __makeTemplateObject, __read } from "tslib";
import React, { useState, useEffect } from 'react';
import { HorizontalGroup, Icon, Spinner, Tooltip, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { isGrafanaRulerRule } from '../../utils/rules';
import { CollapseToggle } from '../CollapseToggle';
import { RulesTable } from './RulesTable';
import { GRAFANA_RULES_SOURCE_NAME, isCloudRulesSource } from '../../utils/datasource';
import { ActionIcon } from './ActionIcon';
import { useHasRuler } from '../../hooks/useHasRuler';
import kbn from 'app/core/utils/kbn';
import { useFolder } from '../../hooks/useFolder';
import { RuleStats } from './RuleStats';
import { EditCloudGroupModal } from './EditCloudGroupModal';
export var RulesGroup = React.memo(function (_a) {
    var _b;
    var group = _a.group, namespace = _a.namespace, expandAll = _a.expandAll;
    var rulesSource = namespace.rulesSource;
    var styles = useStyles2(getStyles);
    var _c = __read(useState(false), 2), isEditingGroup = _c[0], setIsEditingGroup = _c[1];
    var _d = __read(useState(!expandAll), 2), isCollapsed = _d[0], setIsCollapsed = _d[1];
    useEffect(function () {
        setIsCollapsed(!expandAll);
    }, [expandAll]);
    var hasRuler = useHasRuler();
    var rulerRule = (_b = group.rules[0]) === null || _b === void 0 ? void 0 : _b.rulerRule;
    var folderUID = (rulerRule && isGrafanaRulerRule(rulerRule) && rulerRule.grafana_alert.namespace_uid) || undefined;
    var folder = useFolder(folderUID).folder;
    // group "is deleting" if rules source has ruler, but this group has no rules that are in ruler
    var isDeleting = hasRuler(rulesSource) && !group.rules.find(function (rule) { return !!rule.rulerRule; });
    var actionIcons = [];
    // for grafana, link to folder views
    if (isDeleting) {
        actionIcons.push(React.createElement(HorizontalGroup, { key: "is-deleting" },
            React.createElement(Spinner, null),
            "deleting"));
    }
    else if (rulesSource === GRAFANA_RULES_SOURCE_NAME) {
        if (folderUID) {
            var baseUrl = "/dashboards/f/" + folderUID + "/" + kbn.slugifyForUrl(namespace.name);
            if (folder === null || folder === void 0 ? void 0 : folder.canSave) {
                actionIcons.push(React.createElement(ActionIcon, { key: "edit", icon: "pen", tooltip: "edit", to: baseUrl + '/settings', target: "__blank" }));
            }
            if (folder === null || folder === void 0 ? void 0 : folder.canAdmin) {
                actionIcons.push(React.createElement(ActionIcon, { key: "manage-perms", icon: "lock", tooltip: "manage permissions", to: baseUrl + '/permissions', target: "__blank" }));
            }
        }
    }
    else if (hasRuler(rulesSource)) {
        actionIcons.push(React.createElement(ActionIcon, { "data-testid": "edit-group", key: "edit", icon: "pen", tooltip: "edit", onClick: function () { return setIsEditingGroup(true); } }));
    }
    var groupName = isCloudRulesSource(rulesSource) ? namespace.name + " > " + group.name : namespace.name;
    return (React.createElement("div", { className: styles.wrapper, "data-testid": "rule-group" },
        React.createElement("div", { className: styles.header, "data-testid": "rule-group-header" },
            React.createElement(CollapseToggle, { className: styles.collapseToggle, isCollapsed: isCollapsed, onToggle: setIsCollapsed, "data-testid": "group-collapse-toggle" }),
            React.createElement(Icon, { name: isCollapsed ? 'folder' : 'folder-open' }),
            isCloudRulesSource(rulesSource) && (React.createElement(Tooltip, { content: rulesSource.name, placement: "top" },
                React.createElement("img", { className: styles.dataSourceIcon, src: rulesSource.meta.info.logos.small }))),
            React.createElement("h6", { className: styles.heading }, groupName),
            React.createElement("div", { className: styles.spacer }),
            React.createElement("div", { className: styles.headerStats },
                React.createElement(RuleStats, { showInactive: false, group: group })),
            !!actionIcons.length && (React.createElement(React.Fragment, null,
                React.createElement("div", { className: styles.actionsSeparator }, "|"),
                React.createElement("div", { className: styles.actionIcons }, actionIcons)))),
        !isCollapsed && (React.createElement(RulesTable, { showSummaryColumn: true, className: styles.rulesTable, showGuidelines: true, rules: group.rules })),
        isEditingGroup && (React.createElement(EditCloudGroupModal, { group: group, namespace: namespace, onClose: function () { return setIsEditingGroup(false); } }))));
});
RulesGroup.displayName = 'RulesGroup';
export var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    & + & {\n      margin-top: ", ";\n    }\n  "], ["\n    & + & {\n      margin-top: ", ";\n    }\n  "])), theme.spacing(2)),
    header: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    padding: ", " ", " ", " 0;\n    background-color: ", ";\n    flex-wrap: wrap;\n  "], ["\n    display: flex;\n    flex-direction: row;\n    align-items: center;\n    padding: ", " ", " ", " 0;\n    background-color: ", ";\n    flex-wrap: wrap;\n  "])), theme.spacing(1), theme.spacing(1), theme.spacing(1), theme.colors.background.secondary),
    headerStats: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    span {\n      vertical-align: middle;\n    }\n\n    ", " {\n      order: 2;\n      width: 100%;\n      padding-left: ", ";\n    }\n  "], ["\n    span {\n      vertical-align: middle;\n    }\n\n    ", " {\n      order: 2;\n      width: 100%;\n      padding-left: ", ";\n    }\n  "])), theme.breakpoints.down('sm'), theme.spacing(1)),
    heading: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    margin-left: ", ";\n    margin-bottom: 0;\n  "], ["\n    margin-left: ", ";\n    margin-bottom: 0;\n  "])), theme.spacing(1)),
    spacer: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    flex: 1;\n  "], ["\n    flex: 1;\n  "]))),
    collapseToggle: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n    background: none;\n    border: none;\n    margin-top: -", ";\n    margin-bottom: -", ";\n\n    svg {\n      margin-bottom: 0;\n    }\n  "], ["\n    background: none;\n    border: none;\n    margin-top: -", ";\n    margin-bottom: -", ";\n\n    svg {\n      margin-bottom: 0;\n    }\n  "])), theme.spacing(1), theme.spacing(1)),
    dataSourceIcon: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n    width: ", ";\n    height: ", ";\n    margin-left: ", ";\n  "], ["\n    width: ", ";\n    height: ", ";\n    margin-left: ", ";\n  "])), theme.spacing(2), theme.spacing(2), theme.spacing(2)),
    dataSourceOrigin: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n    margin-right: 1em;\n    color: ", ";\n  "], ["\n    margin-right: 1em;\n    color: ", ";\n  "])), theme.colors.text.disabled),
    actionsSeparator: css(templateObject_9 || (templateObject_9 = __makeTemplateObject(["\n    margin: 0 ", ";\n  "], ["\n    margin: 0 ", ";\n  "])), theme.spacing(2)),
    actionIcons: css(templateObject_10 || (templateObject_10 = __makeTemplateObject(["\n    & > * + * {\n      margin-left: ", ";\n    }\n  "], ["\n    & > * + * {\n      margin-left: ", ";\n    }\n  "])), theme.spacing(1)),
    rulesTable: css(templateObject_11 || (templateObject_11 = __makeTemplateObject(["\n    margin-top: ", ";\n  "], ["\n    margin-top: ", ";\n  "])), theme.spacing(3)),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11;
//# sourceMappingURL=RulesGroup.js.map