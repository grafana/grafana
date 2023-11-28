import { __rest } from "tslib";
import React from 'react';
import { LinkButton, useStyles } from '@grafana/ui/src';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { Messages } from './DBaaSPageButtons.messages';
import { getStyles } from './DBaaSPageButtons.styles';
export const DBaaSPageButtons = ({ pageName, cancelUrl, submitBtnProps }) => {
    const { buttonMessage } = submitBtnProps, props = __rest(submitBtnProps, ["buttonMessage"]);
    const styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.buttonsWrapper },
        React.createElement(LinkButton, { href: cancelUrl, "data-testid": `${pageName}-cancel-button`, variant: "secondary", fill: "outline" }, Messages.cancelButton),
        React.createElement(LoaderButton, Object.assign({ "data-testid": `${pageName}-submit-button`, size: "md", type: "submit", variant: "primary" }, props), buttonMessage ? buttonMessage : Messages.confirmButton)));
};
export default DBaaSPageButtons;
//# sourceMappingURL=DBaaSPageButtons.js.map