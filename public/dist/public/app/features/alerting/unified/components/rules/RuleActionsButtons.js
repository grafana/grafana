import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Stack } from '@grafana/experimental';
import { locationService } from '@grafana/runtime';
import { Button, ClipboardButton, ConfirmModal, Dropdown, Icon, LinkButton, Menu, Tooltip, useStyles2, } from '@grafana/ui';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useDispatch } from 'app/types';
import { useIsRuleEditable } from '../../hooks/useIsRuleEditable';
import { deleteRuleAction } from '../../state/actions';
import { getRulesSourceName } from '../../utils/datasource';
import { createShareLink, createViewLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { isFederatedRuleGroup, isGrafanaRulerRule } from '../../utils/rules';
import { createUrl } from '../../utils/url';
import { RedirectToCloneRule } from './CloneRule';
export const matchesWidth = (width) => window.matchMedia(`(max-width: ${width}px)`).matches;
export const RuleActionsButtons = ({ rule, rulesSource }) => {
    const dispatch = useDispatch();
    const location = useLocation();
    const notifyApp = useAppNotification();
    const style = useStyles2(getStyles);
    const [redirectToClone, setRedirectToClone] = useState(undefined);
    const { namespace, group, rulerRule } = rule;
    const [ruleToDelete, setRuleToDelete] = useState();
    const rulesSourceName = getRulesSourceName(rulesSource);
    const isProvisioned = isGrafanaRulerRule(rule.rulerRule) && Boolean(rule.rulerRule.grafana_alert.provenance);
    const buttons = [];
    const moreActions = [];
    const isFederated = isFederatedRuleGroup(group);
    const { isEditable, isRemovable } = useIsRuleEditable(rulesSourceName, rulerRule);
    const returnTo = location.pathname + location.search;
    const isViewMode = inViewMode(location.pathname);
    const deleteRule = () => {
        if (ruleToDelete && ruleToDelete.rulerRule) {
            const identifier = ruleId.fromRulerRule(getRulesSourceName(ruleToDelete.namespace.rulesSource), ruleToDelete.namespace.name, ruleToDelete.group.name, ruleToDelete.rulerRule);
            dispatch(deleteRuleAction(identifier, { navigateTo: isViewMode ? '/alerting/list' : undefined }));
            setRuleToDelete(undefined);
        }
    };
    const buildShareUrl = () => createShareLink(rulesSource, rule);
    const sourceName = getRulesSourceName(rulesSource);
    if (!isViewMode) {
        buttons.push(React.createElement(Tooltip, { placement: "top", content: 'View' },
            React.createElement(LinkButton, { className: style.button, title: "View", size: "sm", key: "view", variant: "secondary", icon: "eye", href: createViewLink(rulesSource, rule, returnTo) })));
    }
    if (rulerRule && !isFederated) {
        const identifier = ruleId.fromRulerRule(sourceName, namespace.name, group.name, rulerRule);
        if (isEditable) {
            if (!isProvisioned) {
                const editURL = createUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/edit`, {
                    returnTo,
                });
                if (isViewMode) {
                    buttons.push(React.createElement(ClipboardButton, { key: "copy", icon: "copy", onClipboardError: (copiedText) => {
                            notifyApp.error('Error while copying URL', copiedText);
                        }, className: style.button, size: "sm", getText: buildShareUrl }, "Copy link to rule"));
                }
                buttons.push(React.createElement(Tooltip, { placement: "top", content: 'Edit' },
                    React.createElement(LinkButton, { title: "Edit", className: style.button, size: "sm", key: "edit", variant: "secondary", icon: "pen", href: editURL })));
            }
            moreActions.push(React.createElement(Menu.Item, { label: "Duplicate", icon: "copy", onClick: () => setRedirectToClone({ identifier, isProvisioned }) }));
        }
        if (isGrafanaRulerRule(rulerRule)) {
            moreActions.push(React.createElement(Menu.Item, { label: "Modify export", icon: "edit", onClick: () => locationService.push(createUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/modify-export`, {
                    returnTo: location.pathname + location.search,
                })) }));
        }
    }
    if (isRemovable && rulerRule && !isFederated && !isProvisioned) {
        moreActions.push(React.createElement(Menu.Item, { label: "Delete", icon: "trash-alt", onClick: () => setRuleToDelete(rule) }));
    }
    if (buttons.length || moreActions.length) {
        return (React.createElement(React.Fragment, null,
            React.createElement(Stack, { gap: 1 },
                buttons.map((button, index) => (React.createElement(React.Fragment, { key: index }, button))),
                moreActions.length > 0 && (React.createElement(Dropdown, { overlay: React.createElement(Menu, null, moreActions.map((action) => (React.createElement(React.Fragment, { key: uniqueId('action_') }, action)))) },
                    React.createElement(Button, { variant: "secondary", size: "sm" },
                        "More",
                        React.createElement(Icon, { name: "angle-down" }))))),
            !!ruleToDelete && (React.createElement(ConfirmModal, { isOpen: true, title: "Delete rule", body: React.createElement("div", null,
                    React.createElement("p", null,
                        "Deleting \"",
                        React.createElement("strong", null, ruleToDelete.name),
                        "\" will permanently remove it from your alert rule list."),
                    React.createElement("p", null, "Are you sure you want to delete this rule?")), confirmText: "Yes, delete", icon: "exclamation-triangle", onConfirm: deleteRule, onDismiss: () => setRuleToDelete(undefined) })),
            redirectToClone && (React.createElement(RedirectToCloneRule, { identifier: redirectToClone.identifier, isProvisioned: redirectToClone.isProvisioned, onDismiss: () => setRedirectToClone(undefined) }))));
    }
    return null;
};
function inViewMode(pathname) {
    return pathname.endsWith('/view');
}
export const getStyles = (theme) => ({
    button: css `
    padding: 0 ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=RuleActionsButtons.js.map