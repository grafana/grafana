import { css } from '@emotion/css';
import { isArray, isObject, isUndefined } from 'lodash';
import React from 'react';
import { useStyles2, Icon } from '@grafana/ui';
export const DiffValues = ({ diff }) => {
    const styles = useStyles2(getStyles);
    const hasLeftValue = !isUndefined(diff.originalValue) && !isArray(diff.originalValue) && !isObject(diff.originalValue);
    const hasRightValue = !isUndefined(diff.value) && !isArray(diff.value) && !isObject(diff.value);
    return (React.createElement(React.Fragment, null,
        hasLeftValue && React.createElement("span", { className: styles }, String(diff.originalValue)),
        hasLeftValue && hasRightValue ? React.createElement(Icon, { name: "arrow-right" }) : null,
        hasRightValue && React.createElement("span", { className: styles }, String(diff.value))));
};
const getStyles = (theme) => css `
  background-color: ${theme.colors.action.hover};
  border-radius: ${theme.shape.radius.default};
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.body.fontSize};
  margin: 0 ${theme.spacing(0.5)};
  padding: ${theme.spacing(0.5, 1)};
`;
//# sourceMappingURL=DiffValues.js.map