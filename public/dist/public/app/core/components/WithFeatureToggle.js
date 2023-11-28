import React from 'react';
export const WithFeatureToggle = ({ featureToggle, children }) => {
    if (featureToggle === true) {
        return React.createElement(React.Fragment, null, children);
    }
    return null;
};
//# sourceMappingURL=WithFeatureToggle.js.map