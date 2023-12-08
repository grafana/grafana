import { cx } from '@emotion/css';
import React, { FC } from 'react';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './DetailsRow.styles';
import { DetailsRowContentProps } from './DetailsRow.types';

export const DetailsRowContent: FC<DetailsRowContentProps> = ({ title, fullRow, children }) => {
  const styles = useStyles2(getStyles);

  return (
    <span className={cx(styles.rowContentWrapper, fullRow && styles.fullRowContent)} data-testid="details-row-content">
      <span>{title}</span>
      <div>{children}</div>
    </span>
  );
};
