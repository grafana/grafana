import { css, cx } from '@emotion/css';
import * as React from 'react';

import { useStyles2 } from '../../themes/ThemeContext';

export interface Props {
  className?: string;
}

export const FullWidthButtonContainer = ({ className, children }: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);

  return <div className={cx(styles, className)}>{children}</div>;
};

const getStyles = () =>
  css({
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
