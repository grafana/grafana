import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { Fragment, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { textUtil, urlUtil } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Button, ClipboardButton, ConfirmModal, Dropdown, HorizontalGroup, Icon, LinkButton, Menu, useStyles2, } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { AlertmanagerChoice } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction, useDispatch } from 'app/types';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { useStateHistoryModal } from '../../hooks/useStateHistoryModal';
import { deleteRuleAction } from '../../state/actions';
import { getRulesPermissions } from '../../utils/access-control';
import { getAlertmanagerByUid } from '../../utils/alertmanager';
import { Annotation } from '../../utils/constants';
import { getRulesSourceName, isCloudRulesSource, isGrafanaRulesSource } from '../../utils/datasource';
import { createExploreLink, createShareLink, isLocalDevEnv, isOpenSourceEdition, makeRuleBasedSilenceLink, } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { isAlertingRule, isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';
import { createUrl } from '../../utils/url';
import { DeclareIncident } from '../bridges/DeclareIncidentButton';
import { RedirectToCloneRule } from './CloneRule';
export const RuleDetailsActionButtons = ({ rule, rulesSource, isViewMode }) => {
    var _a;
    const style = useStyles2(getStyles);
    const { namespace, group, rulerRule } = rule;
    const { StateHistoryModal, showStateHistoryModal } = useStateHistoryModal();
    const dispatch = useDispatch();
    const location = useLocation();
    const notifyApp = useAppNotification();
    const [ruleToDelete, setRuleToDelete] = useState();
    const [redirectToClone, setRedirectToClone] = useState(undefined);
    const alertmanagerSourceName = isGrafanaRulesSource(rulesSource)
        ? rulesSource
        : (_a = getAlertmanagerByUid(rulesSource.jsonData.alertmanagerUid)) === null || _a === void 0 ? void 0 : _a.name;
    const hasExplorePermission = contextSrv.hasPermission(AccessControlAction.DataSourcesExplore);
    const buttons = [];
    const rightButtons = [];
    const moreActionsButtons = [];
    const deleteRule = () => {
        if (ruleToDelete && ruleToDelete.rulerRule) {
            const identifier = ruleId.fromRulerRule(getRulesSourceName(ruleToDelete.namespace.rulesSource), ruleToDelete.namespace.name, ruleToDelete.group.name, ruleToDelete.rulerRule);
            dispatch(deleteRuleAction(identifier, { navigateTo: isViewMode ? '/alerting/list' : undefined }));
            setRuleToDelete(undefined);
        }
    };
    const isFederated = isFederatedRuleGroup(group);
    const rulesSourceName = getRulesSourceName(rulesSource);
    const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);
    const isFiringRule = isAlertingRule(rule.promRule) && rule.promRule.state === PromAlertingRuleState.Firing;
    const rulesPermissions = getRulesPermissions(rulesSourceName);
    const hasCreateRulePermission = contextSrv.hasPermission(rulesPermissions.create);
    const { isEditable, isRemovable } = useIsRuleEditable(rulesSourceName, rulerRule);
    const canSilence = useCanSilence(rule);
    const buildShareUrl = () => createShareLink(rulesSource, rule);
    const returnTo = location.pathname + location.search;
    // explore does not support grafana rule queries atm
    // neither do "federated rules"
    if (isCloudRulesSource(rulesSource) && hasExplorePermission && !isFederated) {
        buttons.push(React.createElement(LinkButton, { size: "sm", key: "explore", variant: "primary", icon: "chart-line", target: "__blank", href: createExploreLink(rulesSource, rule.query) }, "See graph"));
    }
    if (rule.annotations[Annotation.runbookURL]) {
        buttons.push(React.createElement(LinkButton, { size: "sm", key: "runbook", variant: "primary", icon: "book", target: "__blank", href: textUtil.sanitizeUrl(rule.annotations[Annotation.runbookURL]) }, "View runbook"));
    }
    if (rule.annotations[Annotation.dashboardUID]) {
        const dashboardUID = rule.annotations[Annotation.dashboardUID];
        if (dashboardUID) {
            buttons.push(React.createElement(LinkButton, { size: "sm", key: "dashboard", variant: "primary", icon: "apps", target: "__blank", href: `d/${encodeURIComponent(dashboardUID)}` }, "Go to dashboard"));
            const panelId = rule.annotations[Annotation.panelID];
            if (panelId) {
                buttons.push(React.createElement(LinkButton, { size: "sm", key: "panel", variant: "primary", icon: "apps", target: "__blank", href: `d/${encodeURIComponent(dashboardUID)}?viewPanel=${encodeURIComponent(panelId)}` }, "Go to panel"));
            }
        }
    }
    if (canSilence && alertmanagerSourceName) {
        buttons.push(React.createElement(LinkButton, { size: "sm", key: "silence", icon: "bell-slash", target: "__blank", href: makeRuleBasedSilenceLink(alertmanagerSourceName, rule) }, "Silence"));
    }
    if (isGrafanaRulerRule(rule.rulerRule)) {
        buttons.push(React.createElement(Fragment, { key: "history" },
            React.createElement(Button, { size: "sm", icon: "history", onClick: () => isGrafanaRulerRule(rule.rulerRule) && showStateHistoryModal(rule.rulerRule) }, "Show state history"),
            StateHistoryModal));
    }
    if (isFiringRule && shouldShowDeclareIncidentButton()) {
        buttons.push(React.createElement(Fragment, { key: "declare-incident" },
            React.createElement(DeclareIncident, { title: rule.name, url: buildShareUrl() })));
    }
    if (isViewMode && rulerRule) {
        const sourceName = getRulesSourceName(rulesSource);
        const identifier = ruleId.fromRulerRule(sourceName, namespace.name, group.name, rulerRule);
        if (isEditable && !isFederated) {
            rightButtons.push(React.createElement(ClipboardButton, { key: "copy", icon: "copy", onClipboardError: (copiedText) => {
                    notifyApp.error('Error while copying URL', copiedText);
                }, size: "sm", getText: buildShareUrl }, "Copy link to rule"));
            if (!isProvisioned) {
                const editURL = urlUtil.renderUrl(`${config.appSubUrl}/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`, {
                    returnTo,
                });
                rightButtons.push(React.createElement(LinkButton, { size: "sm", key: "edit", variant: "secondary", icon: "pen", href: editURL }, "Edit"));
            }
        }
        if (isGrafanaRulerRule(rulerRule)) {
            moreActionsButtons.push(React.createElement(Menu.Item, { label: "Modify export", icon: "edit", onClick: () => locationService.push(createUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/modify-export`)) }));
        }
        if (hasCreateRulePermission && !isFederated) {
            moreActionsButtons.push(React.createElement(Menu.Item, { label: "Duplicate", icon: "copy", onClick: () => setRedirectToClone({ identifier, isProvisioned }) }));
        }
        if (isRemovable && !isFederated && !isProvisioned) {
            moreActionsButtons.push(React.createElement(Menu.Divider, null));
            moreActionsButtons.push(React.createElement(Menu.Item, { key: "delete", label: "Delete", icon: "trash-alt", onClick: () => setRuleToDelete(rule) }));
        }
    }
    if (buttons.length || rightButtons.length || moreActionsButtons.length) {
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: style.wrapper },
                React.createElement(HorizontalGroup, { width: "auto" }, buttons.length ? buttons : React.createElement("div", null)),
                React.createElement(HorizontalGroup, { width: "auto" },
                    rightButtons.length && rightButtons,
                    moreActionsButtons.length && (React.createElement(Dropdown, { overlay: React.createElement(Menu, null, moreActionsButtons.map((action) => (React.createElement(React.Fragment, { key: uniqueId('action_') }, action)))) },
                        React.createElement(Button, { variant: "secondary", size: "sm" },
                            "More",
                            React.createElement(Icon, { name: "angle-down" })))))),
            !!ruleToDelete && (React.createElement(ConfirmModal, { isOpen: true, title: "Delete rule", body: "Deleting this rule will permanently remove it from your alert rule list. Are you sure you want to delete this rule?", confirmText: "Yes, delete", icon: "exclamation-triangle", onConfirm: deleteRule, onDismiss: () => setRuleToDelete(undefined) })),
            redirectToClone && (React.createElement(RedirectToCloneRule, { identifier: redirectToClone.identifier, isProvisioned: redirectToClone.isProvisioned, onDismiss: () => setRedirectToClone(undefined) }))));
    }
    return null;
};
/**
 * Since Incident isn't available as an open-source product we shouldn't show it for Open-Source licenced editions of Grafana.
 * We should show it in development mode
 */
function shouldShowDeclareIncidentButton() {
    return !isOpenSourceEdition() || isLocalDevEnv();
}
/**
 * We don't want to show the silence button if either
 * 1. the user has no permissions to create silences
 * 2. the admin has configured to only send instances to external AMs
 */
function useCanSilence(rule) {
    const isGrafanaManagedRule = isGrafanaRulerRule(rule.rulerRule);
    const { useGetAlertmanagerChoiceStatusQuery } = alertmanagerApi;
    const { currentData: amConfigStatus, isLoading } = useGetAlertmanagerChoiceStatusQuery(undefined, {
        skip: !isGrafanaManagedRule,
    });
    if (!isGrafanaManagedRule || isLoading) {
        return false;
    }
    const hasPermissions = contextSrv.hasPermission(AccessControlAction.AlertingInstanceCreate);
    const interactsOnlyWithExternalAMs = (amConfigStatus === null || amConfigStatus === void 0 ? void 0 : amConfigStatus.alertmanagersChoice) === AlertmanagerChoice.External;
    const interactsWithAll = (amConfigStatus === null || amConfigStatus === void 0 ? void 0 : amConfigStatus.alertmanagersChoice) === AlertmanagerChoice.All;
    return hasPermissions && (!interactsOnlyWithExternalAMs || interactsWithAll);
}
export const getStyles = (theme) => ({
    wrapper: css `
    padding: ${theme.spacing(2)} 0;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    flex-wrap: wrap;
    border-bottom: solid 1px ${theme.colors.border.medium};
  `,
});
//# sourceMappingURL=RuleDetailsActionButtons.js.map