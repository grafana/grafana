import { css } from '@emotion/css';
import React from 'react';
import { Badge, Card, useStyles2, Icon } from '@grafana/ui';
import { BASE_PATH } from '../constants';
export const LOGO_SIZE = '48px';
export function ProviderCard({ providerId, displayName, enabled, configPath, authType, badges, onClick }) {
    const styles = useStyles2(getStyles);
    configPath = BASE_PATH + (configPath || providerId);
    return (React.createElement(Card, { href: configPath, className: styles.container, onClick: () => onClick && onClick() },
        React.createElement("div", { className: styles.header },
            React.createElement("span", { className: styles.smallText }, authType),
            React.createElement("span", { className: styles.name }, displayName)),
        React.createElement("div", { className: styles.footer },
            React.createElement("div", { className: styles.badgeContainer }, enabled ? React.createElement(Badge, { text: "Enabled", color: "green", icon: "check" }) : React.createElement(Badge, { text: "Not enabled", color: "blue" })),
            React.createElement("span", { className: styles.edit },
                "Edit",
                React.createElement(Icon, { color: "blue", name: 'arrow-right', size: "sm" })))));
}
export const getStyles = (theme) => {
    return {
        container: css `
      min-height: ${theme.spacing(18)};
      display: flex;
      flex-direction: column;
      justify-content: space-around;
      border-radius: ${theme.spacing(0.5)};
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `,
        header: css `
      margin-top: -${theme.spacing(2)};
      display: flex;
      flex-direction: column;
      justify-content: start;
      align-items: flex-start;
      margin-bottom: ${theme.spacing(2)};
    `,
        footer: css `
      margin-top: ${theme.spacing(2)};
      display: flex;
      justify-content: space-between;
      align-items: center;
    `,
        name: css `
      align-self: flex-start;
      font-size: ${theme.typography.h4.fontSize};
      color: ${theme.colors.text.primary};
      margin: 0;
      margin-top: ${theme.spacing(-1)};
    `,
        smallText: css `
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
      padding: ${theme.spacing(1)} 0; // Add some padding
      max-width: 90%; // Add a max-width to prevent text from stretching too wide
    `,
        badgeContainer: css `
      display: flex;
      gap: ${theme.spacing(1)};
    `,
        edit: css `
      display: flex;
      align-items: center;
      color: ${theme.colors.text.link};
      gap: ${theme.spacing(0.5)};
    `,
    };
};
//# sourceMappingURL=ProviderCard.js.map