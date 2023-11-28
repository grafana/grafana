import React from 'react';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';
const AccessRolesEnabledCheck = ({ children }) => {
    const { result: settings } = useSelector(getPerconaSettings);
    if (!(settings === null || settings === void 0 ? void 0 : settings.enableAccessControl)) {
        return null;
    }
    return React.createElement(React.Fragment, null, children);
};
export default AccessRolesEnabledCheck;
//# sourceMappingURL=AccessRolesEnabledCheck.js.map