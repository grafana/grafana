import { css, cx } from '@emotion/css';
import React from 'react';

import { stylesFactory } from '../../themes';

export interface Props {
  className?: string;
}

export const FullWidthButtonContainer = ({ className, children }: React.PropsWithChildren<Props>) => {
  const styles = getStyles();

  return <div className={cx(styles, className)}>{children}</div>;
};

const getStyles = stylesFactory(() => {
  return css`
    display: flex;

    button {
      flex-grow: 1;
      justify-content: center;
    }

    > * {
      flex-grow: 1;
    }

    label {
      flex-grow: 1;
      text-align: center;
    }
  `;
});
