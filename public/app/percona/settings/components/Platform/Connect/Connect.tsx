import { logger, TextInputField, PasswordInputField, LoaderButton } from '@percona/platform-core';
import React, { FC, useState } from 'react';
import { Form, FormRenderProps } from 'react-final-form';

import { AppEvents } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import validators from 'app/percona/shared/helpers/validators';

import { CONNECT_DELAY, INITIAL_VALUES } from '../Platform.constants';
import { Messages } from '../Platform.messages';
import { PlatformService } from '../Platform.service';
import { ConnectProps, ConnectRenderProps } from '../types';

import { getStyles } from './Connect.styles';

export const Connect: FC<ConnectProps> = ({ getSettings }) => {
  const styles = useStyles(getStyles);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async ({ pmmServerName, email, password }: ConnectRenderProps) => {
    setConnecting(true);

    try {
      await PlatformService.connect({
        server_name: pmmServerName,
        email,
        password,
      });

      // We need some short delay for changes to apply before immediately calling getSettings
      setTimeout(() => {
        getSettings();
        appEvents.emit(AppEvents.alertSuccess, [Messages.connectSucceeded]);
        setConnecting(false);
      }, CONNECT_DELAY);
    } catch (e) {
      logger.error(e);
      setConnecting(false);
    }
  };

  const ConnectForm: FC<FormRenderProps<ConnectRenderProps>> = ({ pristine, valid, handleSubmit }) => (
    <form data-testid="connect-form" className={styles.form} onSubmit={handleSubmit} autoComplete="off">
      <legend className={styles.legend}>{Messages.title}</legend>
      <TextInputField
        name="pmmServerName"
        label={Messages.pmmServerName}
        validators={[validators.required]}
        showErrorOnBlur
        required
      />
      <TextInputField
        name="email"
        label={Messages.emailLabel}
        validators={[validators.required, validators.validateEmail]}
        showErrorOnBlur
        required
        parse={(value) => value.trim()}
      />
      <PasswordInputField name="password" label={Messages.passwordLabel} validators={[validators.required]} required />
      <LoaderButton
        data-testid="connect-button"
        type="submit"
        size="md"
        variant="primary"
        disabled={!valid || connecting || pristine}
        loading={connecting}
        className={styles.submitButton}
      >
        {Messages.connect}
      </LoaderButton>
    </form>
  );

  return <Form onSubmit={handleConnect} initialValues={INITIAL_VALUES} render={ConnectForm} />;
};
