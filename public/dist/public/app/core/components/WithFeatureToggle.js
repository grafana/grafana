import React from 'react';
export var WithFeatureToggle = function (_a) {
    var featureToggle = _a.featureToggle, children = _a.children;
    if (featureToggle === true) {
        return React.createElement(React.Fragment, null, children);
    }
    return null;
};
//# sourceMappingURL=WithFeatureToggle.js.map