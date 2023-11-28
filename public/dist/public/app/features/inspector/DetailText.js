import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
const getStyles = (theme) => css `
  padding: ${theme.spacing(0, 2)};
  font-size: ${theme.typography.bodySmall.fontSize};
  color: ${theme.colors.text.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
`;
export const DetailText = ({ children }) => {
    const collapsedTextStyles = useStyles2(getStyles);
    return React.createElement("div", { className: collapsedTextStyles }, children);
};
//# sourceMappingURL=DetailText.js.map