import React, { FC } from 'react';

import { AppEvents } from '@grafana/data';
import { Button, useTheme } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';

import { PlatformLoginService } from '../PlatformLogin.service';

import { Messages } from './LoggedIn.messages';
import { getStyles } from './LoggedIn.styles';

interface LoggedInProps {
  email: string;
  getSettings: () => void;
}

export const LoggedIn: FC<LoggedInProps> = ({ email, getSettings }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const signOut = async () => {
    try {
      await PlatformLoginService.signOut();

      getSettings();
      appEvents.emit(AppEvents.alertSuccess, [Messages.signOutSucceeded]);
    } catch (e) {
      console.error(e);
      appEvents.emit(AppEvents.alertError, [Messages.errors.signOutFailed]);
    }
  };

  return (
    <section data-qa="logged-in-wrapper" className={styles.wrapper}>
      <header className={styles.title}>{Messages.title}</header>
      <p>{Messages.info}</p>
      <p className={styles.email}>
        <u data-qa="logged-in-email">{email}</u>
      </p>
      <Button data-qa="logged-in-sign-out-link" variant="link" onClick={signOut}>
        {Messages.signOut}
      </Button>
    </section>
  );
};
