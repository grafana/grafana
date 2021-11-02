import { __assign } from "tslib";
import { connectWithProvider } from '../../utils/connectWithReduxStore';
import { ModalRoot, ModalsProvider } from '@grafana/ui';
import React from 'react';
/**
 * Component that enables rendering React modals from Angular
 */
export var AngularModalProxy = connectWithProvider(function (props) {
    return (React.createElement(React.Fragment, null,
        React.createElement(ModalsProvider, __assign({}, props),
            React.createElement(ModalRoot, null))));
});
//# sourceMappingURL=AngularModalProxy.js.map