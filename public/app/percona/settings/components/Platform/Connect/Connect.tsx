import { cx } from '@emotion/css';
import React, { FC } from 'react';
import { Form, FormRenderProps } from 'react-final-form';

import { Button, useStyles2 } from '@grafana/ui';
import { LoaderButton } from 'app/percona/shared/components/Elements/LoaderButton';
import { TextInputField } from 'app/percona/shared/components/Form/TextInput';
import { useShowPMMAddressWarning } from 'app/percona/shared/components/hooks/showPMMAddressWarning';
import { getPerconaServer } from 'app/percona/shared/core/selectors';
import validators from 'app/percona/shared/helpers/validators';
import { useSelector } from 'app/types';

import { Messages } from '../Platform.messages';
import { ConnectRenderProps } from '../types';

import { getStyles } from './Connect.styles';
import { ConnectProps } from './Connect.types';
import { PMMServerUrlWarning } from './PMMServerURLWarning/PMMServerUrlWarning';

export const Connect: FC<ConnectProps> = ({ onConnect, connecting, initialValues }) => {
  const styles = useStyles2(getStyles);
  const { saasHost } = useSelector(getPerconaServer);
  const [showPMMAddressWarning] = useShowPMMAddressWarning();

  const ConnectForm: FC<FormRenderProps<ConnectRenderProps>> = ({ valid, handleSubmit }) => (
    <>
      <h4>{Messages.whatIsPerconaPlatform}</h4>
      <p>{Messages.perconaPlatformExplanation}</p>
      <h4>{Messages.whyConnect}</h4>
      <p>{Messages.connectionReason}</p>
      <h4>{Messages.noPerconaAccount}</h4>
      <p>{Messages.createAnAccount}</p>
      <a href={`${saasHost}/login`} rel="noreferrer noopener" target="_blank">
        <Button variant="secondary" icon="external-link-alt">
          {Messages.createPerconaAccountAnchor}
        </Button>
      </a>
      <h2 className={cx(styles.titles, styles.connectionTitle)}>{Messages.connectTitle}</h2>
      <form data-testid="connect-form" className={styles.form} onSubmit={handleSubmit} autoComplete="off">
        <div className={styles.serverDetails}>
          <TextInputField name="pmmServerId" disabled label={Messages.pmmServerId} />
          <TextInputField
            name="pmmServerName"
            label={Messages.pmmServerName}
            validators={[validators.required]}
            showErrorOnBlur
            required
            disabled={connecting}
          />
        </div>
        <div className={styles.accessTokenRow}>
          <TextInputField
            name="accessToken"
            label={Messages.accessToken}
            validators={[validators.required]}
            placeholder={Messages.tokenHerePlaceholder}
            showErrorOnBlur
            required
            disabled={connecting}
          />
          <a href={`${saasHost}/profile`} rel="noreferrer noopener" target="_blank" className={styles.getTokenAnchor}>
            <Button variant="secondary" fill="text" icon="external-link-alt">
              {Messages.getToken}
            </Button>
          </a>
        </div>
        {showPMMAddressWarning && <PMMServerUrlWarning />}
        <LoaderButton
          data-testid="connect-button"
          type="submit"
          size="md"
          variant="primary"
          disabled={connecting}
          loading={connecting}
          className={styles.submitButton}
        >
          {Messages.connect}
        </LoaderButton>
      </form>
    </>
  );

  return (
    <Form
      onSubmit={(values) => onConnect(values, showPMMAddressWarning)}
      initialValues={initialValues}
      render={ConnectForm}
    />
  );
};
