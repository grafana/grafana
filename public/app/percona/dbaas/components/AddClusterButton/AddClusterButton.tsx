import React, { FC } from 'react';

import { Button, useStyles } from '@grafana/ui';

import { getStyles } from './AddClusterButton.styles';
import { AddClusterButtonProps } from './AddClusterButton.types';

export const AddClusterButton: FC<React.PropsWithChildren<AddClusterButtonProps>> = ({ label, disabled, action, ...props }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.addClusterButtonWrapper}>
      <Button role="button" size="md" onClick={action} icon="plus-square" fill="text" disabled={disabled} {...props}>
        {label}
      </Button>
    </div>
  );
};
