import React from 'react';
import { Alert } from '@grafana/ui';
import { FadeIn } from 'app/core/components/Animations/FadeIn';
export const ErrorContainer = (props) => {
    var _a;
    const { queryError } = props;
    const showError = queryError ? true : false;
    const duration = showError ? 100 : 10;
    const title = queryError ? 'Query error' : 'Unknown error';
    const message = (queryError === null || queryError === void 0 ? void 0 : queryError.message) || ((_a = queryError === null || queryError === void 0 ? void 0 : queryError.data) === null || _a === void 0 ? void 0 : _a.message) || null;
    return (React.createElement(FadeIn, { in: showError, duration: duration },
        React.createElement(Alert, { severity: "error", title: title, topSpacing: 2 }, message)));
};
//# sourceMappingURL=ErrorContainer.js.map