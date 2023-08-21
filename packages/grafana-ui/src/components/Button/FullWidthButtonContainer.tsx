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
  return css({
    display: 'flex',

    button: {
      flexGrow: 1,
      justifyContent: 'center',
    },

    '> *': {
      flexGrow: 1,
    },

    label: {
      flexGrow: 1,
      textAlign: 'center',
    },
  });
});
