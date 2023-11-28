import React from 'react';
import { Alert, JSONFormatter } from '@grafana/ui';
const parseErrorMessage = (message) => {
    try {
        const [msg, json] = message.split(/(\{.+)/);
        const jsonError = JSON.parse(json);
        return {
            msg,
            json: jsonError,
        };
    }
    catch (_a) {
        return { msg: message };
    }
};
function renderError(error) {
    if (error.data) {
        return (React.createElement(React.Fragment, null,
            React.createElement("h4", null, error.data.message),
            React.createElement(JSONFormatter, { json: error, open: 2 })));
    }
    if (error.message) {
        const { msg, json } = parseErrorMessage(error.message);
        if (!json) {
            return (React.createElement(React.Fragment, null,
                error.status && React.createElement(React.Fragment, null,
                    "Status: ",
                    error.status,
                    ". Message: "),
                msg,
                error.traceId != null && (React.createElement(React.Fragment, null,
                    React.createElement("br", null),
                    "(Trace ID: ",
                    error.traceId,
                    ")"))));
        }
        else {
            return (React.createElement(React.Fragment, null,
                msg !== '' && React.createElement("h3", null, msg),
                error.status && React.createElement(React.Fragment, null,
                    "Status: ",
                    error.status),
                React.createElement(JSONFormatter, { json: json, open: 5 })));
        }
    }
    return React.createElement(JSONFormatter, { json: error, open: 2 });
}
export const InspectErrorTab = ({ errors }) => {
    if (!(errors === null || errors === void 0 ? void 0 : errors.length)) {
        return null;
    }
    if (errors.length === 1) {
        return renderError(errors[0]);
    }
    return (React.createElement(React.Fragment, null, errors.map((error, index) => (React.createElement(Alert, { title: error.refId || `Error ${index + 1}`, severity: "error", key: index }, renderError(error))))));
};
//# sourceMappingURL=InspectErrorTab.js.map