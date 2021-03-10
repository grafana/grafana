import { Icon, useStyles } from '@grafana/ui';
import React from 'react';
import { getDiffTitleStyles } from './DiffTitle';

type DiffSummaryProps = {
  operation: 'add' | 'replace' | 'remove';
  name: string;
};

export const getChangeText = (operation: string): string => {
  if (operation === 'replace') {
    return 'changed';
  }
  if (operation === 'remove') {
    return 'deleted';
  }
  return 'added';
};

export const DiffSummary: React.FC<DiffSummaryProps> = ({ operation, name }) => {
  const styles = useStyles(getDiffTitleStyles);
  return (
    <div style={{ marginBottom: 8 }}>
      <Icon name="circle" className={styles[operation]} /> <strong>{name}</strong>{' '}
      <span>{getChangeText(operation)}</span>
    </div>
  );
};
