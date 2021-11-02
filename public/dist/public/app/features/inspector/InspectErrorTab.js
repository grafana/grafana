import React from 'react';
import { JSONFormatter } from '@grafana/ui';
export var InspectErrorTab = function (_a) {
    var error = _a.error;
    if (!error) {
        return null;
    }
    if (error.data) {
        return (React.createElement(React.Fragment, null,
            React.createElement("h3", null, error.data.message),
            React.createElement(JSONFormatter, { json: error, open: 2 })));
    }
    return React.createElement("div", null, error.message);
};
//# sourceMappingURL=InspectErrorTab.js.map