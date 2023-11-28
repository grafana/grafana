import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Alert, Button, useTheme2 } from '@grafana/ui';
export function SupplementaryResultError(props) {
    var _a;
    const [isOpen, setIsOpen] = useState(false);
    const SHORT_ERROR_MESSAGE_LIMIT = 100;
    const { error, title, suggestedAction, onSuggestedAction, onRemove, severity = 'warning' } = props;
    // generic get-error-message-logic, taken from
    // /public/app/features/explore/ErrorContainer.tsx
    const message = (error === null || error === void 0 ? void 0 : error.message) || ((_a = error === null || error === void 0 ? void 0 : error.data) === null || _a === void 0 ? void 0 : _a.message) || '';
    const showButton = !isOpen && message.length > SHORT_ERROR_MESSAGE_LIMIT;
    const theme = useTheme2();
    const styles = getStyles(theme);
    return (React.createElement("div", { className: styles.supplementaryErrorContainer },
        React.createElement(Alert, { title: title, severity: severity, onRemove: onRemove },
            React.createElement("div", { className: styles.suggestedActionWrapper },
                showButton ? (React.createElement(Button, { variant: "secondary", size: "xs", onClick: () => {
                        setIsOpen(true);
                    } }, "Show details")) : (message),
                suggestedAction && onSuggestedAction && (React.createElement("div", { className: styles.suggestedActionWrapper },
                    React.createElement(Button, { variant: "primary", size: "xs", onClick: onSuggestedAction }, suggestedAction)))))));
}
const getStyles = (theme) => {
    return {
        supplementaryErrorContainer: css `
      width: 50%;
      min-width: ${theme.breakpoints.values.sm}px;
      margin: 0 auto;
    `,
        suggestedActionWrapper: css `
      height: ${theme.spacing(6)};
      button {
        position: absolute;
        right: ${theme.spacing(2)};
        top: ${theme.spacing(7)};
      }
    `,
    };
};
//# sourceMappingURL=SupplementaryResultError.js.map