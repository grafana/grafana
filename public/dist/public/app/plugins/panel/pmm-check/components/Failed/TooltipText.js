import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { getStyles } from './Failed.styles';
import { Messages } from './TooltipText.messages';
export const TooltipText = ({ counts: { emergency, critical, alert, error, warning, debug, info, notice }, }) => {
    const styles = useStyles2(getStyles);
    const sum = emergency + critical + alert + error + warning + debug + info + notice;
    if (!sum) {
        return null;
    }
    return (React.createElement("div", { className: styles.TooltipWrapper },
        React.createElement("div", { className: styles.TooltipHeader },
            Messages.failedChecks,
            "\u00A0",
            sum),
        React.createElement("div", { className: styles.TooltipBody, "data-testid": "checks-tooltip-body" },
            React.createElement("div", null,
                Messages.emergency,
                " \u2013\u00A0",
                emergency),
            React.createElement("div", null,
                Messages.alert,
                " \u2013\u00A0",
                alert),
            React.createElement("div", null,
                Messages.critical,
                " \u2013\u00A0",
                critical),
            React.createElement("div", null,
                Messages.error,
                " \u2013\u00A0",
                error),
            React.createElement("div", null,
                Messages.warning,
                " \u2013\u00A0",
                warning),
            React.createElement("div", null,
                Messages.notice,
                " \u2013\u00A0",
                notice),
            React.createElement("div", null,
                Messages.info,
                " \u2013\u00A0",
                info),
            React.createElement("div", null,
                Messages.debug,
                " \u2013\u00A0",
                debug))));
};
//# sourceMappingURL=TooltipText.js.map