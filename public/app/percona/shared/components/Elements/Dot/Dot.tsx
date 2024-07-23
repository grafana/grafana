import classNames from 'classnames';
import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './Dot.styles';
import { DotProps } from './Dot.types';

export const Dot: FC<DotProps> = ({ top, bottom, right, left }) => {
  const styles = useStyles2(getStyles, top, bottom, right, left);

  return <div className={classNames(styles.dot)} />;
};
