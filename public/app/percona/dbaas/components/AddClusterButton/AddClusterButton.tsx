import React, { FC } from 'react';
import { Button, useStyles } from '@grafana/ui';
import { AddClusterButtonProps } from './AddClusterButton.types';
import { getStyles } from './AddClusterButton.styles';

export const AddClusterButton: FC<AddClusterButtonProps> = ({ label, disabled, action, ...props }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.addClusterButtonWrapper}>
      <Button size="md" onClick={action} icon="plus-square" variant="link" disabled={disabled} {...props}>
        {label}
      </Button>
    </div>
  );
};
