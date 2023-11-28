import React from 'react';
import { Messages } from './ProgressModalHeader.messages';
export const ProgressModalHeader = ({ errorMessage = '', isUpdated = false, updateFailed = false, }) => (React.createElement(React.Fragment, null, isUpdated ? (React.createElement("h4", null, Messages.updateSucceeded)) : !updateFailed ? (React.createElement("h4", null, Messages.updateInProgress)) : (React.createElement(React.Fragment, null,
    React.createElement("h4", null, Messages.updateFailed),
    React.createElement("h4", null, errorMessage)))));
//# sourceMappingURL=ProgressModalHeader.js.map