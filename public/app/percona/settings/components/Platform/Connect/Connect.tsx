import { LoaderButton, TextInputField } from '@percona/platform-core';
import React, { FC } from 'react';
import { Form, FormRenderProps } from 'react-final-form';
import { useSelector } from 'react-redux';

import { useStyles } from '@grafana/ui';
import { PMMServerUrlWarning } from 'app/percona/dbaas/components/PMMServerURLWarning/PMMServerUrlWarning';
import { useShowPMMAddressWarning } from 'app/percona/shared/components/hooks/showPMMAddressWarning';
import { getPerconaServer } from 'app/percona/shared/core/selectors';
import validators from 'app/percona/shared/helpers/validators';

import { Messages } from '../Platform.messages';
import { ConnectRenderProps } from '../types';

import { getStyles } from './Connect.styles';
import { ConnectProps } from './Connect.types';

export const Connect: FC<ConnectProps> = ({ onConnect, connecting, initialValues }) => {
  const styles = useStyles(getStyles);
  const { saasHost } = useSelector(getPerconaServer);
  const [showPMMAddressWarning] = useShowPMMAddressWarning();

  const ConnectForm: FC<FormRenderProps<ConnectRenderProps>> = ({ valid, handleSubmit }) => (
    <form data-testid="connect-form" className={styles.form} onSubmit={handleSubmit} autoComplete="off">
      <legend className={styles.legend}>{Messages.title}</legend>
      {showPMMAddressWarning && <PMMServerUrlWarning />}
      <TextInputField name="pmmServerId" disabled label={Messages.pmmServerId} />
      <TextInputField
        name="pmmServerName"
        label={Messages.pmmServerName}
        validators={[validators.required]}
        showErrorOnBlur
        required
        disabled={connecting}
      />
      <div className={styles.accessTokenRow}>
        <TextInputField
          name="accessToken"
          label={Messages.accessToken}
          validators={[validators.required]}
          showErrorOnBlur
          required
          disabled={connecting}
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
        disabled={!valid || connecting}
        loading={connecting}
        className={styles.submitButton}
      >
        {Messages.connect}
      </LoaderButton>
    </form>
  );

  return (
    <Form
      onSubmit={(values) => onConnect(values, showPMMAddressWarning)}
      initialValues={initialValues}
      render={ConnectForm}
    />
  );
};
