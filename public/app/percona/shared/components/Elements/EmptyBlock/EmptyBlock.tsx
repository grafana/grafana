import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { getStyles } from './EmptyBlock.styles';
import { EmptyBlockProps } from './EmptyBlock.types';

export const EmptyBlock: FC<EmptyBlockProps> = ({ children, dataTestId }) => {
  const style = useStyles(getStyles);

  return (
    <div className={style.emptyBlockWrapper} data-testid={dataTestId}>
      {children}
    </div>
  );
};
