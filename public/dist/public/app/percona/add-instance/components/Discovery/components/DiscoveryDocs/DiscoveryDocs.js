import React from 'react';
import { Button, useStyles } from '@grafana/ui';
import { IAM_ROLE_DOC_LINK, SECURITY_CREDENTIALS_DOC_LINK } from './DiscoveryDocs.constants';
import { Messages } from './DiscoveryDocs.messages';
import { getStyles } from './DiscoveryDocs.styles';
export const DiscoveryDocs = () => {
    const styles = useStyles(getStyles);
    return (React.createElement("div", { "data-testid": "discovery-docs", className: styles.infoWrapper },
        React.createElement("ul", { className: styles.infoItems },
            React.createElement("li", null,
                React.createElement(Button, { type: "button", fill: "text", onClick: () => window.open(SECURITY_CREDENTIALS_DOC_LINK, '_blank') }, Messages.credentialsDocLink)),
            React.createElement("li", null,
                React.createElement(Button, { type: "button", fill: "text", onClick: () => window.open(IAM_ROLE_DOC_LINK, '_blank') }, Messages.iamRoleDocLink)))));
};
//# sourceMappingURL=DiscoveryDocs.js.map