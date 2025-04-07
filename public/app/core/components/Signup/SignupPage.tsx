import { useForm } from 'react-hook-form';

import { getBackendSrv } from '@grafana/runtime';
import { Field, Input, Button, LinkButton, Stack } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { useAppNotification } from 'app/core/copy/appNotification';
import { t, Trans } from 'app/core/internationalization';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { w3cStandardEmailValidator } from 'app/features/admin/utils';

import { InnerBox, LoginLayout } from '../Login/LoginLayout';
import { PasswordField } from '../PasswordField/PasswordField';

interface SignupDTO {
  name?: string;
  email: string;
  username: string;
  orgName?: string;
  password: string;
  code: string;
  confirm?: string;
}

interface QueryParams {
  email?: string;
  code?: string;
}

interface Props extends GrafanaRouteComponentProps<{}, QueryParams> {}

export const SignupPage = ({ queryParams }: Props) => {
  const notifyApp = useAppNotification();
  const {
    handleSubmit,
    formState: { errors },
    register,
    getValues,
  } = useForm<SignupDTO>({ defaultValues: { email: queryParams.email, code: queryParams.code } });

  const onSubmit = async (formData: SignupDTO) => {
    if (formData.name === '') {
      delete formData.name;
    }
    delete formData.confirm;

    const response = await getBackendSrv()
      .post('/api/user/signup/step2', {
        email: formData.email,
        code: formData.code,
        username: formData.email,
        orgName: formData.orgName,
        password: formData.password,
        name: formData.name,
      })
      .catch((err) => {
        const msg = err.data?.message || err;
        notifyApp.warning(msg);
      });

    if (response.code === 'redirect-to-select-org') {
      window.location.assign(getConfig().appSubUrl + '/profile/select-org?signup=1');
    }
    window.location.assign(getConfig().appSubUrl + '/');
  };

  return (
    <LoginLayout>
      <InnerBox>
        <form onSubmit={handleSubmit(onSubmit)} style={{ width: '100%' }}>
          <Field label={t('sign-up.user-name-label', 'Your name')}>
            <Input
              id="user-name"
              {...register('name')}
              placeholder={t('sign-up.user-name-placeholder', '(optional)')}
            />
          </Field>
          <Field label={t('sign-up.email-label', 'Email')} invalid={!!errors.email} error={errors.email?.message}>
            <Input
              id="email"
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: w3cStandardEmailValidator,
                  message: 'Email is invalid',
                },
              })}
              type="email"
            />
          </Field>
          {!getConfig().autoAssignOrg && (
            <Field label={t('sign-up.org-name-label', 'Org. name')}>
              <Input id="org-name" {...register('orgName')} />
            </Field>
          )}
          {getConfig().verifyEmailEnabled && (
            <Field label={t('sign-up.verification-code-label', 'Email verification code (sent to your email)')}>
              <Input id="verification-code" {...register('code')} />
            </Field>
          )}
          <Field
            label={t('sign-up.password-label', 'Password')}
            invalid={!!errors.password}
            error={errors?.password?.message}
          >
            <PasswordField
              id="new-password"
              autoFocus
              autoComplete="new-password"
              {...register('password', { required: 'Password is required' })}
            />
          </Field>
          <Field
            label={t('sign-up.confirm-password-label', 'Confirm password')}
            invalid={!!errors.confirm}
            error={errors?.confirm?.message}
          >
            <PasswordField
              id="confirm-new-password"
              autoComplete="new-password"
              {...register('confirm', {
                required: 'Confirmed password is required',
                validate: (v) => v === getValues().password || 'Passwords must match!',
              })}
            />
          </Field>

          <Stack>
            <Button type="submit">
              <Trans i18nKey="sign-up.submit-button">Submit</Trans>
            </Button>
            <LinkButton fill="text" href={getConfig().appSubUrl + '/login'}>
              <Trans i18nKey="sign-up.back-button">Back to login</Trans>
            </LinkButton>
          </Stack>
        </form>
      </InnerBox>
    </LoginLayout>
  );
};

export default SignupPage;
