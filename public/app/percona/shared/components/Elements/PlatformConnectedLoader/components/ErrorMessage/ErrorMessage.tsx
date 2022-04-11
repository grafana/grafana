import React from 'react';

import { useStyles } from '@grafana/ui';

import { PLATFORM_SETTINGS_URL } from './ErrorMessage.contants';
import { Messages } from './ErrorMessage.messages';
import { getStyles } from './ErrorMessage.styles';

export const ErrorMessage = () => {
  const styles = useStyles(getStyles);
  return (
    <>
      {Messages.notConnected}&nbsp;
      <a data-testid="platform-link" className={styles.link} href={PLATFORM_SETTINGS_URL}>
        {Messages.portalSettings}
      </a>
    </>
  );
};
