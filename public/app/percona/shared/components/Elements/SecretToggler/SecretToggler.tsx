import { cx } from '@emotion/css';
import React, { FC, useMemo, useState } from 'react';

import { Icon, useStyles } from '@grafana/ui';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';

import { getStyles } from './SecretToggler.styles';
import { SecretTogglerProps } from './SecretToggler.types';

export const SecretToggler: FC<SecretTogglerProps> = ({ secret, readOnly, fieldProps, small, maxLength }) => {
  const [visible, setVisible] = useState(false);
  const styles = useStyles(getStyles);

  const toggleVisibility = () => setVisible((visible) => !visible);

  const iconButton = useMemo(
    () => (
      <Icon
        size={small ? 'sm' : 'lg'}
        className={cx(styles.lock, small ? [] : styles.fullLock)}
        onClick={toggleVisibility}
        name={visible ? 'eye-slash' : 'eye'}
      />
    ),
    [visible, small, styles.lock, styles.fullLock]
  );

  const hiddenSecret = useMemo(() => secret?.replace(/./g, '*'), [secret]);

  return (
    <div className={styles.fieldWrapper}>
      {small ? (
        <span data-testid="small-secret-holder" className={styles.smallPassword}>
          {visible ? secret : hiddenSecret}
        </span>
      ) : (
        <TextInputField
          name={fieldProps?.name || 'secret'}
          inputProps={{ type: visible ? 'text' : 'password', readOnly, maxLength }}
          initialValue={secret}
          {...fieldProps}
        />
      )}
      {iconButton}
    </div>
  );
};

SecretToggler.defaultProps = {
  readOnly: true,
  small: false,
};
