import { css } from '@emotion/css';
import React from 'react';
import { useStyles2, PanelContainer } from '@grafana/ui';
export const NoData = () => {
    const css = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement(PanelContainer, { "data-testid": "explore-no-data", className: css.wrapper },
            React.createElement("span", { className: css.message }, 'No data'))));
};
const getStyles = (theme) => ({
    wrapper: css `
    label: no-data-card;
    padding: ${theme.spacing(3)};
    background: ${theme.colors.background.primary};
    border-radius: ${theme.shape.radius.default};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-grow: 1;
  `,
    message: css `
    font-size: ${theme.typography.h2.fontSize};
    padding: ${theme.spacing(4)};
    color: ${theme.colors.text.disabled};
  `,
});
//# sourceMappingURL=NoData.js.map