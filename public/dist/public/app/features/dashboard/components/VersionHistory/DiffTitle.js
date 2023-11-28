import { css } from '@emotion/css';
import React from 'react';
import { useStyles2, Icon } from '@grafana/ui';
import { DiffValues } from './DiffValues';
import { getDiffText } from './utils';
const replaceDiff = { op: 'replace', originalValue: undefined, path: [''], value: undefined, startLineNumber: 0 };
export const DiffTitle = ({ diff, title }) => {
    const styles = useStyles2(getDiffTitleStyles);
    return diff ? (React.createElement(React.Fragment, null,
        React.createElement(Icon, { type: "mono", name: "circle", className: styles[diff.op] }),
        " ",
        React.createElement("span", { className: styles.embolden }, title),
        ' ',
        React.createElement("span", null, getDiffText(diff, diff.path.length > 1)),
        " ",
        React.createElement(DiffValues, { diff: diff }))) : (React.createElement("div", { className: styles.withoutDiff },
        React.createElement(Icon, { type: "mono", name: "circle", className: styles.replace }),
        " ",
        React.createElement("span", { className: styles.embolden }, title),
        ' ',
        React.createElement("span", null, getDiffText(replaceDiff, false))));
};
const getDiffTitleStyles = (theme) => ({
    embolden: css `
    font-weight: ${theme.typography.fontWeightBold};
  `,
    add: css `
    color: ${theme.colors.success.main};
  `,
    replace: css `
    color: ${theme.colors.success.main};
  `,
    move: css `
    color: ${theme.colors.success.main};
  `,
    copy: css `
    color: ${theme.colors.success.main};
  `,
    _get: css `
    color: ${theme.colors.success.main};
  `,
    test: css `
    color: ${theme.colors.success.main};
  `,
    remove: css `
    color: ${theme.colors.success.main};
  `,
    withoutDiff: css `
    margin-bottom: ${theme.spacing(2)};
  `,
});
//# sourceMappingURL=DiffTitle.js.map