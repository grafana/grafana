import React from 'react';
import { ModalRoot, ModalsProvider } from '@grafana/ui';
import { connectWithProvider } from '../../utils/connectWithReduxStore';
/**
 * Component that enables rendering React modals from Angular
 */
export const AngularModalProxy = connectWithProvider((props) => {
    return (React.createElement(React.Fragment, null,
        React.createElement(ModalsProvider, Object.assign({}, props),
            React.createElement(ModalRoot, null))));
});
//# sourceMappingURL=AngularModalProxy.js.map