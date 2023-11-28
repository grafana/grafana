import { css } from '@emotion/css';
import React from 'react';
import { Button, LinkButton, useStyles2 } from '@grafana/ui';
import { EmptyArea } from './EmptyArea';
export const EmptyAreaWithCTA = ({ buttonIcon, buttonLabel, buttonSize = 'lg', buttonVariant = 'primary', onButtonClick, text, href, showButton = true, }) => {
    const styles = useStyles2(getStyles);
    const commonProps = {
        className: styles.button,
        icon: buttonIcon,
        size: buttonSize,
        variant: buttonVariant,
    };
    return (React.createElement(EmptyArea, null,
        React.createElement(React.Fragment, null,
            React.createElement("p", { className: styles.text }, text),
            showButton &&
                (href ? (React.createElement(LinkButton, Object.assign({ href: href, type: "button" }, commonProps), buttonLabel)) : (React.createElement(Button, Object.assign({ onClick: onButtonClick, type: "button" }, commonProps), buttonLabel))))));
};
const getStyles = (theme) => {
    return {
        container: css `
      background-color: ${theme.colors.background.secondary};
      color: ${theme.colors.text.secondary};
      padding: ${theme.spacing(4)};
      text-align: center;
    `,
        text: css `
      margin-bottom: ${theme.spacing(2)};
    `,
        button: css `
      margin: ${theme.spacing(2, 0, 1)};
    `,
    };
};
//# sourceMappingURL=EmptyAreaWithCTA.js.map