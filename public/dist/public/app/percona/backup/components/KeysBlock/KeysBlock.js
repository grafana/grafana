import React from 'react';
import { useStyles } from '@grafana/ui';
import { SecretToggler } from 'app/percona/shared/components/Elements/SecretToggler';
import { Messages } from './KeysBlock.messages';
import { getStyles } from './KeysBlock.styles';
export const KeysBlock = ({ accessKey, secretKey }) => {
    const styles = useStyles(getStyles);
    return (React.createElement("div", { className: styles.keysWrapper },
        React.createElement("div", { "data-testid": "access-key" },
            React.createElement("span", { className: styles.keyLabel }, Messages.accessKey),
            accessKey),
        React.createElement("div", { "data-testid": "secret-key" },
            React.createElement("span", { className: styles.keyLabel }, Messages.secretKey),
            React.createElement("span", { className: styles.secretTogglerWrapper },
                React.createElement(SecretToggler, { small: true, secret: secretKey })))));
};
//# sourceMappingURL=KeysBlock.js.map