import { css } from '@emotion/css';
import React, { FC } from 'react';

import { useTheme2 } from '../../themes/ThemeContext';

export interface Props {
  name: string;
  children?: React.ReactNode;
}

export const StoryExample: FC<Props> = ({ name, children }) => {
  const theme = useTheme2();
  const style = css`
    width: 100%;
    padding: 16px;
  `;
  const heading = css`
    color: ${theme.colors.text.secondary};
    margin-bottom: 16px;
  `;

  return (
    <div className={style}>
      <h5 className={heading}>{name}</h5>
      {children}
    </div>
  );
};

StoryExample.displayName = 'StoryExample';
