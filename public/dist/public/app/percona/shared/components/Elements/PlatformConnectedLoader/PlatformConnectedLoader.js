import React from 'react';
import { getPerconaSettings, getPerconaUser } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';
import { EmptyBlock } from '../EmptyBlock';
import { Messages } from './PlatformConnectedLoader.messages';
export const PlatformConnectedLoader = ({ children }) => {
    const { isPlatformUser, isAuthorized } = useSelector(getPerconaUser);
    const { result } = useSelector(getPerconaSettings);
    const { isConnectedToPortal } = result;
    if (isPlatformUser) {
        return React.createElement(React.Fragment, null, children);
    }
    else {
        if (isConnectedToPortal) {
            return React.createElement(EmptyBlock, { dataTestId: "not-platform-user" }, Messages.platformUser);
        }
        else {
            if (!isAuthorized) {
                return React.createElement(EmptyBlock, { dataTestId: "unauthorized" }, Messages.unauthorized);
            }
            return React.createElement(EmptyBlock, { dataTestId: "not-connected-platform" }, Messages.notConnected);
        }
    }
};
//# sourceMappingURL=PlatformConnectedLoader.js.map