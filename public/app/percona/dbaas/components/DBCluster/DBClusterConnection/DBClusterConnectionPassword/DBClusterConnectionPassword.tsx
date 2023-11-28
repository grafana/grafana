import React, { FC, useMemo, useState } from 'react';

import { IconButton, useStyles } from '@grafana/ui';

import { DBClusterConnectionItem } from '../DBClusterConnectionItem/DBClusterConnectionItem';

import { HIDDEN_PASSWORD_LENGTH } from './DBClusterConnectionPassword.constants';
import { getStyles } from './DBClusterConnectionPassword.styles';
import { DBClusterConnectionPasswordProps } from './DBClusterConnectionPassword.types';

export const DBClusterConnectionPassword: FC<React.PropsWithChildren<DBClusterConnectionPasswordProps>> = ({ label, password, dataTestId }) => {
  const styles = useStyles(getStyles);
  const [showPassword, setShowPassword] = useState(false);
  const getHiddenPassword = useMemo(() => '*'.repeat(HIDDEN_PASSWORD_LENGTH), []);

  return (
    <div className={styles.connectionPasswordWrapper}>
      <DBClusterConnectionItem
        label={label}
        value={showPassword ? password : getHiddenPassword}
        dataTestId={dataTestId}
      />
      <IconButton
        data-testid="show-password-button"
        aria-label='Show password'
        name={showPassword ? 'eye-slash' : 'eye'}
        onClick={() => setShowPassword(!showPassword)}
        className={styles.showPasswordButton}
      />
    </div>
  );
};
