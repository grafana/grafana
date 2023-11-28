import { css } from '@emotion/css';
import { last } from 'lodash';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { DiffTitle } from './DiffTitle';
import { DiffValues } from './DiffValues';
import { getDiffText } from './utils';
export const DiffGroup = ({ diffs, title }) => {
    const styles = useStyles2(getStyles);
    if (diffs.length === 1) {
        return (React.createElement("div", { className: styles.container, "data-testid": "diffGroup" },
            React.createElement(DiffTitle, { title: title, diff: diffs[0] })));
    }
    return (React.createElement("div", { className: styles.container, "data-testid": "diffGroup" },
        React.createElement(DiffTitle, { title: title }),
        React.createElement("ul", { className: styles.list }, diffs.map((diff, idx) => {
            return (React.createElement("li", { className: styles.listItem, key: `${last(diff.path)}__${idx}` },
                React.createElement("span", null, getDiffText(diff)),
                " ",
                React.createElement(DiffValues, { diff: diff })));
        }))));
};
const getStyles = (theme) => ({
    container: css `
    background-color: ${theme.colors.background.secondary};
    font-size: ${theme.typography.h6.fontSize};
    margin-bottom: ${theme.spacing(2)};
    padding: ${theme.spacing(2)};
  `,
    list: css `
    margin-left: ${theme.spacing(4)};
  `,
    listItem: css `
    margin-bottom: ${theme.spacing(1)};
  `,
});
//# sourceMappingURL=DiffGroup.js.map