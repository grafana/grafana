import { css } from '@emotion/css';
import React from 'react';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
export const OrgUnits = ({ units, icon }) => {
    const styles = useStyles2(getStyles);
    if (!(units === null || units === void 0 ? void 0 : units.length)) {
        return null;
    }
    return units.length > 1 ? (React.createElement(Tooltip, { placement: 'top', content: React.createElement("div", { className: styles.unitTooltip }, units === null || units === void 0 ? void 0 : units.map((unit) => React.createElement("span", { key: unit.name }, unit.name))) },
        React.createElement("div", { className: styles.unitItem },
            React.createElement(Icon, { name: icon }),
            " ",
            React.createElement("span", null, units.length)))) : (React.createElement("span", { className: styles.unitItem },
        React.createElement(Icon, { name: icon }),
        " ",
        units[0].name));
};
const getStyles = (theme) => {
    return {
        unitTooltip: css `
      display: flex;
      flex-direction: column;
    `,
        unitItem: css `
      padding: ${theme.spacing(0.5)} 0;
      margin-right: ${theme.spacing(1)};

      svg {
        margin-bottom: ${theme.spacing(0.25)};
      }
    `,
        link: css `
      color: inherit;
      cursor: pointer;
      text-decoration: underline;
    `,
    };
};
//# sourceMappingURL=OrgUnits.js.map