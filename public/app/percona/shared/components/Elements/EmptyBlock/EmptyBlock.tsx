import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './EmptyBlock.styles';
import { EmptyBlockProps } from './EmptyBlock.types';

export const EmptyBlock: FC<React.PropsWithChildren<EmptyBlockProps>> = ({ children, dataTestId }) => {
  const style = useStyles2(getStyles);

  return (
    <div className={style.emptyBlockWrapper} data-testid={dataTestId}>
      {children}
    </div>
  );
};
