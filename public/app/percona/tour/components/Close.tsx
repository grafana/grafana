// there is a problem with exported types from react tour
// @ts-ignore
import { CloseProps } from '@reactour/tour/dist/components/Close';
import React, { FC } from 'react';

import { IconButton, useStyles2 } from '@grafana/ui';

import { getStyles } from './Close.styles';

const Close: FC<React.PropsWithChildren<CloseProps>> = ({ onClick }) => {
  const styles = useStyles2(getStyles);

  return <IconButton aria-label='Close tour' className={styles.button} onClick={onClick} name="times" size="lg" />;
};

export default Close;
