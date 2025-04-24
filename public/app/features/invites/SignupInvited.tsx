import { css, cx } from '@emotion/css';
import { useState } from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Field, Input, useStyles2 } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { Page } from 'app/core/components/Page/Page';
import { getConfig } from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';

import { w3cStandardEmailValidator } from '../admin/utils';

interface FormModel {
  email: string;
  name?: string;
  username: string;
  password?: string;
  orgName?: string;
}

const navModel = {
  main: {
    icon: 'grafana' as const,
    text: 'Invite',
    subTitle: 'Register your Grafana account',
    breadcrumbs: [{ title: 'Login', url: 'login' }],
  },
  node: {
    text: '',
  },
};

export const SignupInvitedPage = () => {
  const { code } = useParams();
  const [initFormModel, setInitFormModel] = useState<FormModel>();
  const [greeting, setGreeting] = useState<string>();
  const [invitedBy, setInvitedBy] = useState<string>();
  const styles = useStyles2(getStyles);

  useAsync(async () => {
    const invite = await getBackendSrv().get(`/api/user/invite/${code}`);

    setInitFormModel({
      email: invite.email,
      name: invite.name,
      username: invite.email,
      orgName: invite.orgName,
    });

    setGreeting(invite.name || invite.email || invite.username);
    setInvitedBy(invite.invitedBy);
  }, [code]);

  const onSubmit = async (formData: FormModel) => {
    await getBackendSrv().post('/api/user/invite/complete', { ...formData, inviteCode: code });
    window.location.href = getConfig().appSubUrl + '/';
  };

  if (!initFormModel) {
    return null;
  }

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h3 className="page-sub-heading">
          {greeting
            ? t('invites.signup-invited-page.greeting-custom', 'Hello {{greeting}}.', { greeting })
            : t('invites.signup-invited-page.greeting-default', 'Hello there.')}
        </h3>

        <div className={cx('modal-tagline', styles.tagline)}>
          {invitedBy ? (
            <Trans
              i18nKey="invites.signup-invited-page.custom-has-invited-you"
              values={{ invitedBy, orgName: initFormModel.orgName }}
            >
              <em>{'{{invitedBy}}'}</em> has invited you to join Grafana and the organization{' '}
              <span className="highlight-word">{'{{orgName}}'}</span>
            </Trans>
          ) : (
            <Trans
              i18nKey="invites.signup-invited-page.default-has-invited-you"
              values={{ orgName: initFormModel.orgName }}
            >
              <em>Someone</em> has invited you to join Grafana and the organization{' '}
              <span className="highlight-word">{'{{orgName}}'}</span>
            </Trans>
          )}
          <br />
          <Trans i18nKey="invites.signup-invited-page.complete-following">
            Please complete the following and choose a password to accept your invitation and continue:
          </Trans>
        </div>
        <Form defaultValues={initFormModel} onSubmit={onSubmit}>
          {({ register, errors }) => (
            <>
              <Field
                invalid={!!errors.email}
                error={errors.email && errors.email.message}
                label={t('invites.signup-invited-page.label-email', 'Email')}
              >
                <Input
                  // eslint-disable-next-line @grafana/no-untranslated-strings
                  placeholder="email@example.com"
                  {...register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: w3cStandardEmailValidator,
                      message: 'Email is invalid',
                    },
                  })}
                />
              </Field>
              <Field
                invalid={!!errors.name}
                error={errors.name && errors.name.message}
                label={t('invites.signup-invited-page.label-name', 'Name')}
              >
                <Input
                  placeholder={t('invites.signup-invited-page.placeholder-name-optional', 'Name (optional)')}
                  {...register('name')}
                />
              </Field>
              <Field
                invalid={!!errors.username}
                error={errors.username && errors.username.message}
                label={t('invites.signup-invited-page.label-username', 'Username')}
              >
                <Input
                  {...register('username', { required: 'Username is required' })}
                  placeholder={t('invites.signup-invited-page.placeholder-username', 'Username')}
                />
              </Field>
              <Field
                invalid={!!errors.password}
                error={errors.password && errors.password.message}
                label={t('invites.signup-invited-page.label-password', 'Password')}
              >
                <Input
                  {...register('password', { required: 'Password is required' })}
                  type="password"
                  placeholder={t('invites.signup-invited-page.placeholder-password', 'Password')}
                />
              </Field>

              <Button type="submit">
                <Trans i18nKey="invites.signup-invited-page.sign-up">Sign up</Trans>
              </Button>
            </>
          )}
        </Form>
      </Page.Contents>
    </Page>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  tagline: css({
    paddingBottom: theme.spacing(3),
  }),
});

export default SignupInvitedPage;
