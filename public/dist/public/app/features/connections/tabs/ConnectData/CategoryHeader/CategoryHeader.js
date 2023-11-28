import { css } from '@emotion/css';
import React from 'react';
import { Icon, useStyles2 } from '@grafana/ui';
const getStyles = (theme) => ({
    categoryHeader: css `
    align-items: center;
    display: flex;
    margin-bottom: 24px;
  `,
    categoryLabel: css `
    margin-bottom: 0px;
    margin-left: 8px;
  `,
});
export const CategoryHeader = ({ iconName, label }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.categoryHeader },
        React.createElement(Icon, { name: iconName, size: "xl" }),
        React.createElement("h3", { className: styles.categoryLabel }, label)));
};
//# sourceMappingURL=CategoryHeader.js.map