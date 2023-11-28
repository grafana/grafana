import { cx } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { Icon, useStyles } from '@grafana/ui';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { getStyles } from './SecretToggler.styles';
export const SecretToggler = ({ secret, readOnly, fieldProps, small, maxLength }) => {
    const [visible, setVisible] = useState(false);
    const styles = useStyles(getStyles);
    const toggleVisibility = () => setVisible((visible) => !visible);
    const iconButton = useMemo(() => (React.createElement(Icon, { size: small ? 'sm' : 'lg', className: cx(styles.lock, small ? [] : styles.fullLock), onClick: toggleVisibility, name: visible ? 'eye-slash' : 'eye' })), [visible, small, styles.lock, styles.fullLock]);
    const hiddenSecret = useMemo(() => secret === null || secret === void 0 ? void 0 : secret.replace(/./g, '*'), [secret]);
    return (React.createElement("div", { className: styles.fieldWrapper },
        small ? (React.createElement("span", { "data-testid": "small-secret-holder", className: styles.smallPassword }, visible ? secret : hiddenSecret)) : (React.createElement(TextInputField, Object.assign({ name: (fieldProps === null || fieldProps === void 0 ? void 0 : fieldProps.name) || 'secret', inputProps: { type: visible ? 'text' : 'password', readOnly, maxLength }, initialValue: secret }, fieldProps))),
        iconButton));
};
SecretToggler.defaultProps = {
    readOnly: true,
    small: false,
};
//# sourceMappingURL=SecretToggler.js.map