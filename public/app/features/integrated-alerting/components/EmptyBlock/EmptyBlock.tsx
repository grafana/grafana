import { useStyles } from '@grafana/ui';
import React, { FC } from 'react';
import { getStyles } from './EmptyBlock.styles';
import { EmptyBlockProps } from './EmptyBlock.types';

export const EmptyBlock: FC<EmptyBlockProps> = ({ children, dataQa }) => {
  const style = useStyles(getStyles);

  return (
    <div className={style.emptyBlockWrapper} data-qa={dataQa}>
      {children}
    </div>
  );
};
