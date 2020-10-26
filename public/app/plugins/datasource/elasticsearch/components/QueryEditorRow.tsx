import { css, cx } from 'emotion';
import React, { FunctionComponent } from 'react';

const flex = css`
  display: flex;
`;

const alignItemsStart = css`
  align-items: start;
`;

export const QueryEditorRow: FunctionComponent = ({ children }) => (
  <div className={flex}>
    <div className={cx(flex, alignItemsStart)}>{children}</div>
  </div>
);
