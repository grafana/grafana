import React, { useMemo, useState } from 'react';
import { IconButton, useStyles } from '@grafana/ui';
import { DBClusterConnectionItem } from '../DBClusterConnectionItem/DBClusterConnectionItem';
import { HIDDEN_PASSWORD_LENGTH } from './DBClusterConnectionPassword.constants';
import { getStyles } from './DBClusterConnectionPassword.styles';
export const DBClusterConnectionPassword = ({ label, password, dataTestId }) => {
    const styles = useStyles(getStyles);
    const [showPassword, setShowPassword] = useState(false);
    const getHiddenPassword = useMemo(() => '*'.repeat(HIDDEN_PASSWORD_LENGTH), []);
    return (React.createElement("div", { className: styles.connectionPasswordWrapper },
        React.createElement(DBClusterConnectionItem, { label: label, value: showPassword ? password : getHiddenPassword, dataTestId: dataTestId }),
        React.createElement(IconButton, { "data-testid": "show-password-button", "aria-label": 'Show password', name: showPassword ? 'eye-slash' : 'eye', onClick: () => setShowPassword(!showPassword), className: styles.showPasswordButton })));
};
//# sourceMappingURL=DBClusterConnectionPassword.js.map