import { CloseProps } from '@reactour/tour/dist/components/Close';
import React, { FC } from 'react';

import { IconButton, useStyles2 } from '@grafana/ui';

import { getStyles } from './Close.styles';

const Close: FC<CloseProps> = ({ onClick }) => {
  const styles = useStyles2(getStyles);

  return <IconButton className={styles.button} onClick={onClick} name="times" size="lg" />;
};

export default Close;
