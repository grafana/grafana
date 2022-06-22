import { logger, LoaderButton, TextInputField } from '@percona/platform-core';
import React, { FC, useState } from 'react';
import { Form, FormRenderProps } from 'react-final-form';
import { useDispatch, useSelector } from 'react-redux';

import { AppEvents } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { fetchServerInfoAction, fetchSettingsAction } from 'app/percona/shared/core/reducers';
import { getPerconaServer } from 'app/percona/shared/core/selectors';
import validators from 'app/percona/shared/helpers/validators';

import { CONNECT_DELAY } from '../Platform.constants';
import { Messages } from '../Platform.messages';
import { PlatformService } from '../Platform.service';
import { ConnectRenderProps } from '../types';

import { getStyles } from './Connect.styles';

export const Connect: FC = () => {
  const styles = useStyles(getStyles);
  const [connecting, setConnecting] = useState(false);
  const dispatch = useDispatch();
  const { serverId: pmmServerId = '', saasHost } = useSelector(getPerconaServer);
  const initialValues: ConnectRenderProps = {
    pmmServerName: '',
    pmmServerId,
    accessToken: '',
  };

  const handleConnect = async ({ pmmServerName, accessToken }: ConnectRenderProps) => {
    setConnecting(true);

    try {
      await PlatformService.connect({
        server_name: pmmServerName,
        personal_access_token: accessToken,
      });

      // We need some short delay for changes to apply before immediately calling getSettings
      setTimeout(() => {
        appEvents.emit(AppEvents.alertSuccess, [Messages.connectSucceeded]);
        setConnecting(false);
        dispatch(fetchServerInfoAction());
        dispatch(fetchSettingsAction());
      }, CONNECT_DELAY);
    } catch (e) {
      logger.error(e);
      setConnecting(false);
    }
  };

  const ConnectForm: FC<FormRenderProps<ConnectRenderProps>> = ({ pristine, valid, handleSubmit }) => (
    <form data-testid="connect-form" className={styles.form} onSubmit={handleSubmit} autoComplete="off">
      <legend className={styles.legend}>{Messages.title}</legend>
      <TextInputField name="pmmServerId" disabled label={Messages.pmmServerId} />
      <TextInputField
        name="pmmServerName"
        label={Messages.pmmServerName}
        validators={[validators.required]}
        showErrorOnBlur
        required
      />
      <div className={styles.accessTokenRow}>
        <TextInputField
          name="accessToken"
          label={Messages.accessToken}
          validators={[validators.required]}
          showErrorOnBlur
          required
        />
        <a href={`${saasHost}/profile`} rel="noreferrer noopener" target="_blank">
          Get token
        </a>
      </div>
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

  return <Form onSubmit={handleConnect} initialValues={initialValues} render={ConnectForm} />;
};
