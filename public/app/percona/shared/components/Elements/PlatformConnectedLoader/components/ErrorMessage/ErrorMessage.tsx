import React from 'react';
import { Messages } from './ErrorMessage.messages';
import { useStyles } from '@grafana/ui';
import { getStyles } from './ErrorMessage.styles';
import { PLATFORM_SETTINGS_URL } from './ErrorMessage.contants';

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
