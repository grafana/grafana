import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { getStyles } from './DetailsRow.styles';
import { DetailsRowType } from './DetailsRow.types';
import { DetailsRowContent } from './DetailsRowContent';

export const DetailsRow: DetailsRowType = ({ children }) => {
  const styles = useStyles2(getStyles);

  return <div className={styles.row}>{children}</div>;
};

DetailsRow.Contents = DetailsRowContent;
