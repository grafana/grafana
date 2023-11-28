import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Redirect } from 'react-router-dom';
import { Button, ConfirmModal, useStyles2 } from '@grafana/ui';
import * as ruleId from '../../utils/rule-id';
export function RedirectToCloneRule({ identifier, isProvisioned, onDismiss }) {
    const styles = useStyles2(getStyles);
    // For provisioned rules an additional confirmation step is required
    // Users have to be aware that the cloned rule will NOT be marked as provisioned
    const [stage, setStage] = useState(isProvisioned ? 'confirm' : 'redirect');
    if (stage === 'redirect') {
        const cloneUrl = `/alerting/new?copyFrom=${ruleId.stringifyIdentifier(identifier)}`;
        return React.createElement(Redirect, { to: cloneUrl, push: true });
    }
    return (React.createElement(ConfirmModal, { isOpen: stage === 'confirm', title: "Copy provisioned alert rule", body: React.createElement("div", null,
            React.createElement("p", null,
                "The new rule will ",
                React.createElement("span", { className: styles.bold }, "NOT"),
                " be marked as a provisioned rule."),
            React.createElement("p", null, "You will need to set a new evaluation group for the copied rule because the original one has been provisioned and cannot be used for rules created in the UI.")), confirmText: "Copy", onConfirm: () => setStage('redirect'), onDismiss: onDismiss }));
}
export const CloneRuleButton = React.forwardRef(({ text, ruleIdentifier, isProvisioned, className }, ref) => {
    const [redirectToClone, setRedirectToClone] = useState(false);
    return (React.createElement(React.Fragment, null,
        React.createElement(Button, { title: "Copy", className: className, size: "sm", key: "clone", variant: "secondary", icon: "copy", onClick: () => setRedirectToClone(true), ref: ref }, text),
        redirectToClone && (React.createElement(RedirectToCloneRule, { identifier: ruleIdentifier, isProvisioned: isProvisioned, onDismiss: () => setRedirectToClone(false) }))));
});
CloneRuleButton.displayName = 'CloneRuleButton';
const getStyles = (theme) => ({
    bold: css `
    font-weight: ${theme.typography.fontWeightBold};
  `,
});
//# sourceMappingURL=CloneRule.js.map