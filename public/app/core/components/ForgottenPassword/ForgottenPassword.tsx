import React, { useState } from 'react';
import { Unsubscribable } from 'rxjs';
import { css } from '@emotion/css';
import {
  Alert,
  Button,
  Container,
  FadeTransition,
  Field,
  Form,
  HorizontalGroup,
  Input,
  Legend,
  LinkButton,
  useStyles2,
} from '@grafana/ui';
import { getBackendSrv, toDataQueryError } from '@grafana/runtime';
import { GrafanaTheme2 } from '@grafana/data';

import { getConfig } from 'app/core/config';

interface EmailDTO {
  userOrEmail: string;
}

export interface SendResetEmailDTO {
  message: string;
  error?: string;
}

export function ForgottenPassword(): JSX.Element {
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = useStyles2(getStyles);
  const loginHref = `${getConfig().appSubUrl}/login`;

  const sendEmail = (formModel: EmailDTO) => {
    setError(null);
    // using fetch here so we can disable showSuccessAlert, showErrorAlert and handle those
    const subscription: Unsubscribable = getBackendSrv()
      .fetch<SendResetEmailDTO>({
        url: '/api/user/password/send-reset-email',
        method: 'POST',
        data: formModel,
        showSuccessAlert: false,
        showErrorAlert: false,
      })
      .subscribe({
        next: (response) => {
          const { error, message } = response.data; // the backend api can respond with 200 Ok but still have an error set

          if (error) {
            setError(error);
          } else if (message) {
            setEmailSent(true);
          }

          subscription.unsubscribe(); // unsubscribe as soon as a value is received
        },
        error: (err) => {
          const dataError = toDataQueryError(err);
          setError(dataError.message ?? 'Unknown error');
          subscription.unsubscribe(); // unsubscribe as soon as an error is received
        },
      });
  };

  if (emailSent) {
    return (
      <div>
        <p>An email with a reset link has been sent to the email address. You should receive it shortly.</p>
        <Container margin="md" />
        <LinkButton variant="primary" href={loginHref}>
          Back to login
        </LinkButton>
      </div>
    );
  }

  return (
    <>
      <Form onSubmit={sendEmail}>
        {({ register, errors }) => (
          <>
            <Legend>Reset password</Legend>
            <Field
              label="User"
              description="Enter your information to get a reset link sent to you"
              invalid={!!errors.userOrEmail}
              error={errors?.userOrEmail?.message}
            >
              <Input
                id={'userOrEmail'}
                placeholder="Email or username"
                {...register('userOrEmail', { required: true })}
              />
            </Field>
            <HorizontalGroup>
              <Button>Send reset email</Button>
              <LinkButton fill="text" href={loginHref}>
                Back to login
              </LinkButton>
            </HorizontalGroup>

            <p className={styles}>Did you forget your username or email? Contact your Grafana administrator.</p>
          </>
        )}
      </Form>
      <FadeTransition duration={150} visible={Boolean(error)}>
        <Alert title="Couldn't send reset link to the email address" severity={'error'}>
          <span>
            <strong>Reason:&nbsp;</strong>
            {error}
          </span>
        </Alert>
      </FadeTransition>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.size.sm};
    font-weight: ${theme.typography.fontWeightRegular};
    margin-top: ${theme.spacing(1)};
    display: block;
  `;
}
