import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom-v5-compat';

import { type NavModelItem } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Input, Field } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

interface UserDTO {
  name: string;
  password: string;
  email?: string;
  login?: string;
}

const createUser = async (user: UserDTO) => getBackendSrv().post('/api/admin/users', user);

const pageNav: NavModelItem = {
  icon: 'user',
  id: 'user-new',
  text: 'Новый пользователь',
  subTitle: 'Создайте нового пользователя Grafana.',
};

const UserCreatePage = () => {
  const navigate = useNavigate();
  const {
    handleSubmit,
    register,
    formState: { errors },
  } = useForm<UserDTO>({ mode: 'onBlur' });

  const onSubmit = useCallback(
    async (data: UserDTO) => {
      const { uid } = await createUser(data);

      navigate(`/admin/users/edit/${uid}`);
    },
    [navigate]
  );

  return (
    <Page navId="global-users" pageNav={pageNav}>
      <Page.Contents>
        <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: '600px' }}>
<<<<<<< HEAD
          <Field label="Имя" required invalid={!!errors.name} error={errors.name ? 'Имя обязательно' : undefined}>
=======
          <Field
            label={t('admin.user-create-page.label-name', 'Name')}
            required
            invalid={!!errors.name}
            error={errors.name ? 'Name is required' : undefined}
          >
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
            <Input id="name-input" {...register('name', { required: true })} />
          </Field>

          <Field label={t('admin.user-create-page.label-email', 'Email')}>
            <Input id="email-input" {...register('email')} />
          </Field>

<<<<<<< HEAD
          <Field label="Логин">
            <Input id="username-input" {...register('login')} />
          </Field>
          <Field
            label="Пароль"
=======
          <Field label={t('admin.user-create-page.label-username', 'Username')}>
            <Input id="username-input" {...register('login')} />
          </Field>
          <Field
            label={t('admin.user-create-page.label-password', 'Password')}
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
            required
            invalid={!!errors.password}
            error={errors.password ? 'Password is required and must contain at least 4 characters' : undefined}
          >
            <Input
              id="password-input"
              {...register('password', {
                validate: (value) => value.trim() !== '' && value.length >= 4,
              })}
              type="password"
            />
          </Field>
<<<<<<< HEAD
          <Button type="submit">Создать пользователя</Button>
=======
          <Button type="submit">
            <Trans i18nKey="admin.users-create.create-button">Create user</Trans>
          </Button>
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
        </form>
      </Page.Contents>
    </Page>
  );
};

export default UserCreatePage;
