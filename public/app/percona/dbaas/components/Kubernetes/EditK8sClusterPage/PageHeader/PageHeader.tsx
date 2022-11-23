import React from 'react';

import { useStyles } from '@grafana/ui/src';

import { getStyles } from './PageHeader.styles';

export const PageHeader = ({ header }: { header: string }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.headerContainer}>
      <h2>{header}</h2>
      <hr />
    </div>
  );
};
