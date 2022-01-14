import React, { FC } from 'react';
import { useStyles } from '@grafana/ui';
import { SecretToggler } from 'app/percona/shared/components/Elements/SecretToggler';
import { KeysBlockProps } from './KeysBlock.types';
import { getStyles } from './KeysBlock.styles';
import { Messages } from './KeysBlock.messages';

export const KeysBlock: FC<KeysBlockProps> = ({ accessKey, secretKey }) => {
  const styles = useStyles(getStyles);

  return (
    <div className={styles.keysWrapper}>
      <div data-testid="access-key">
        <span className={styles.keyLabel}>{Messages.accessKey}</span>
        {accessKey}
      </div>
      <div data-testid="secret-key">
        <span className={styles.keyLabel}>{Messages.secretKey}</span>
        <span className={styles.secretTogglerWrapper}>
          <SecretToggler small secret={secretKey} />
        </span>
      </div>
    </div>
  );
};
