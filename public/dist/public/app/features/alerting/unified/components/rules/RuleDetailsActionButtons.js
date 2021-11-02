import { __makeTemplateObject, __read } from "tslib";
import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { css } from '@emotion/css';
import { AppEvents, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, ConfirmModal, ClipboardButton, HorizontalGroup, LinkButton, useStyles2 } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { appEvents } from 'app/core/core';
import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { Annotation } from '../../utils/constants';
import { getRulesSourceName, isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { createExploreLink, createViewLink, makeSilenceLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { deleteRuleAction } from '../../state/actions';
import { getAlertmanagerByUid } from '../../utils/alertmanager';
export var RuleDetailsActionButtons = function (_a) {
    var _b;
    var rule = _a.rule, rulesSource = _a.rulesSource;
    var dispatch = useDispatch();
    var location = useLocation();
    var style = useStyles2(getStyles);
    var namespace = rule.namespace, group = rule.group, rulerRule = rule.rulerRule;
    var _c = __read(useState(), 2), ruleToDelete = _c[0], setRuleToDelete = _c[1];
    var alertmanagerSourceName = isGrafanaRulesSource(rulesSource)
        ? rulesSource
        : (_b = getAlertmanagerByUid(rulesSource.jsonData.alertmanagerUid)) === null || _b === void 0 ? void 0 : _b.name;
    var leftButtons = [];
    var rightButtons = [];
    var isEditable = useIsRuleEditable(getRulesSourceName(rulesSource), rulerRule).isEditable;
    var returnTo = location.pathname + location.search;
    var isViewMode = inViewMode(location.pathname);
    var deleteRule = function () {
        if (ruleToDelete && ruleToDelete.rulerRule) {
            var identifier = ruleId.fromRulerRule(getRulesSourceName(ruleToDelete.namespace.rulesSource), ruleToDelete.namespace.name, ruleToDelete.group.name, ruleToDelete.rulerRule);
            dispatch(deleteRuleAction(identifier, { navigateTo: isViewMode ? '/alerting/list' : undefined }));
            setRuleToDelete(undefined);
        }
    };
    var buildShareUrl = function () {
        if (isCloudRulesSource(rulesSource)) {
            var ruleUrl = encodeURIComponent(rulesSource.name) + "/" + encodeURIComponent(rule.name);
            return "" + config.appUrl + config.appSubUrl + "/alerting/" + ruleUrl + "/find";
        }
        return window.location.href.split('?')[0];
    };
    // explore does not support grafana rule queries atm
    if (isCloudRulesSource(rulesSource) && contextSrv.isEditor) {
        leftButtons.push(React.createElement(LinkButton, { className: style.button, size: "xs", key: "explore", variant: "primary", icon: "chart-line", target: "__blank", href: createExploreLink(rulesSource.name, rule.query) }, "See graph"));
    }
    if (rule.annotations[Annotation.runbookURL]) {
        leftButtons.push(React.createElement(LinkButton, { className: style.button, size: "xs", key: "runbook", variant: "primary", icon: "book", target: "__blank", href: rule.annotations[Annotation.runbookURL] }, "View runbook"));
    }
    if (rule.annotations[Annotation.dashboardUID]) {
        var dashboardUID = rule.annotations[Annotation.dashboardUID];
        if (dashboardUID) {
            leftButtons.push(React.createElement(LinkButton, { className: style.button, size: "xs", key: "dashboard", variant: "primary", icon: "apps", target: "__blank", href: "d/" + encodeURIComponent(dashboardUID) }, "Go to dashboard"));
            var panelId = rule.annotations[Annotation.panelID];
            if (panelId) {
                leftButtons.push(React.createElement(LinkButton, { className: style.button, size: "xs", key: "dashboard", variant: "primary", icon: "apps", target: "__blank", href: "d/" + encodeURIComponent(dashboardUID) + "?viewPanel=" + encodeURIComponent(panelId) }, "Go to panel"));
            }
        }
    }
    if (alertmanagerSourceName) {
        leftButtons.push(React.createElement(LinkButton, { className: style.button, size: "xs", key: "silence", icon: "bell-slash", target: "__blank", href: makeSilenceLink(alertmanagerSourceName, rule) }, "Silence"));
    }
    if (!isViewMode) {
        rightButtons.push(React.createElement(LinkButton, { className: style.button, size: "xs", key: "view", variant: "secondary", icon: "eye", href: createViewLink(rulesSource, rule, returnTo) }, "View"));
    }
    if (isEditable && rulerRule) {
        var sourceName = getRulesSourceName(rulesSource);
        var identifier = ruleId.fromRulerRule(sourceName, namespace.name, group.name, rulerRule);
        var editURL = urlUtil.renderUrl(config.appSubUrl + "/alerting/" + encodeURIComponent(ruleId.stringifyIdentifier(identifier)) + "/edit", {
            returnTo: returnTo,
        });
        if (isViewMode) {
            rightButtons.push(React.createElement(ClipboardButton, { onClipboardCopy: function () {
                    appEvents.emit(AppEvents.alertSuccess, ['URL copied!']);
                }, onClipboardError: function (e) {
                    appEvents.emit(AppEvents.alertError, ['Error while copying URL', e.text]);
                }, className: style.button, size: "sm", getText: buildShareUrl }, "Copy link to rule"));
        }
        rightButtons.push(React.createElement(LinkButton, { className: style.button, size: "xs", key: "edit", variant: "secondary", icon: "pen", href: editURL }, "Edit"), React.createElement(Button, { className: style.button, size: "xs", type: "button", key: "delete", variant: "secondary", icon: "trash-alt", onClick: function () { return setRuleToDelete(rule); } }, "Delete"));
    }
    if (leftButtons.length || rightButtons.length) {
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: style.wrapper },
                React.createElement(HorizontalGroup, { width: "auto" }, leftButtons.length ? leftButtons : React.createElement("div", null)),
                React.createElement(HorizontalGroup, { width: "auto" }, rightButtons.length ? rightButtons : React.createElement("div", null))),
            !!ruleToDelete && (React.createElement(ConfirmModal, { isOpen: true, title: "Delete rule", body: "Deleting this rule will permanently remove it from your alert rule list. Are you sure you want to delete this rule?", confirmText: "Yes, delete", icon: "exclamation-triangle", onConfirm: deleteRule, onDismiss: function () { return setRuleToDelete(undefined); } }))));
    }
    return null;
};
function inViewMode(pathname) {
    return pathname.endsWith('/view');
}
export var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    padding: ", " 0;\n    display: flex;\n    flex-direction: row;\n    justify-content: space-between;\n    flex-wrap: wrap;\n    border-bottom: solid 1px ", ";\n  "], ["\n    padding: ", " 0;\n    display: flex;\n    flex-direction: row;\n    justify-content: space-between;\n    flex-wrap: wrap;\n    border-bottom: solid 1px ", ";\n  "])), theme.spacing(2), theme.colors.border.medium),
    button: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    height: 24px;\n    margin-top: ", ";\n    font-size: ", ";\n  "], ["\n    height: 24px;\n    margin-top: ", ";\n    font-size: ", ";\n  "])), theme.spacing(1), theme.typography.size.sm),
}); };
var templateObject_1, templateObject_2;
//# sourceMappingURL=RuleDetailsActionButtons.js.map