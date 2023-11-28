import { css } from '@emotion/css';
import React from 'react';
import { Spinner } from '@grafana/ui';
export const LoadingIndicator = ({ place }) => {
    const text = place === 'above' ? 'Loading newer logs...' : 'Loading older logs...';
    return (React.createElement("div", { className: loadingIndicatorStyles },
        React.createElement("div", null,
            text,
            " ",
            React.createElement(Spinner, { inline: true }))));
};
const loadingIndicatorStyles = css `
  display: flex;
  justify-content: center;
`;
//# sourceMappingURL=LoadingIndicator.js.map