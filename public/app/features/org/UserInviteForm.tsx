import { Controller } from 'react-hook-form';

import { locationUtil, OrgRole, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import {
  Button,
  LinkButton,
  Input,
  Switch,
  RadioButtonGroup,
  Field,
  FieldSet,
  Icon,
  TextLink,
  Tooltip,
  Label,
  Stack,
} from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { useDispatch } from 'app/types/store';

import { Form } from '../../core/components/Form/Form';
import { addInvitee } from '../invites/state/actions';

const tooltipMessage = (
  <>
    <Trans i18nKey="org.user-invite-form.tooltip">
      You can now select the &quot;No basic role&quot; option and add permissions to your custom needs. You can find
      more information in&nbsp;
      <TextLink
        href="https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/#organization-roles"
        variant="bodySmall"
        external
      >
        our documentation
      </TextLink>
      .
    </Trans>
  </>
);

const roles: Array<SelectableValue<OrgRole>> = Object.values(OrgRole).map((r) => ({
  label: r === OrgRole.None ? 'No basic role' : r,
  value: r,
}));

export interface FormModel {
  role: OrgRole;
  name: string;
  loginOrEmail?: string;
  sendEmail: boolean;
  email: string;
}

const defaultValues: FormModel = {
  name: '',
  email: '',
  role: OrgRole.Editor,
  sendEmail: true,
};

export const UserInviteForm = () => {
  const dispatch = useDispatch();

  const onSubmit = async (formData: FormModel) => {
    await dispatch(addInvitee(formData)).unwrap();
    locationService.push('/admin/users/');
  };

  return (
    <Form defaultValues={defaultValues} onSubmit={onSubmit}>
      {({ register, control, errors }) => {
        return (
          <>
            <FieldSet>
              <Field
                invalid={!!errors.loginOrEmail}
                error={!!errors.loginOrEmail ? 'Email or username is required' : undefined}
                label={t('org.user-invite-form.label-email-or-username', 'Email or username')}
              >
                {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                <Input {...register('loginOrEmail', { required: true })} placeholder="email@example.com" />
              </Field>
              <Field invalid={!!errors.name} label={t('org.user-invite-form.label-name', 'Name')}>
                <Input
                  {...register('name')}
                  placeholder={t('org.user-invite-form.placeholder-optional', '(optional)')}
                />
              </Field>
              <Field
                invalid={!!errors.role}
                label={
                  <Label>
                    <Stack gap={0.5}>
                      <span>
                        <Trans i18nKey="org.user-invite-form.role">Role</Trans>
                      </span>
                      {tooltipMessage && (
                        <Tooltip placement="right-end" interactive={true} content={tooltipMessage}>
                          <Icon name="info-circle" size="xs" />
                        </Tooltip>
                      )}
                    </Stack>
                  </Label>
                }
              >
                <Controller
                  render={({ field: { ref, ...field } }) => <RadioButtonGroup {...field} options={roles} />}
                  control={control}
                  name="role"
                />
              </Field>
              <Field label={t('org.user-invite-form.label-send-invite-email', 'Send invite email')}>
                <Switch id="send-email-switch" {...register('sendEmail')} />
              </Field>
            </FieldSet>
            <Stack>
              <Button type="submit">
                <Trans i18nKey="org.user-invite-form.submit">Submit</Trans>
              </Button>
              <LinkButton href={locationUtil.assureBaseUrl(getConfig().appSubUrl + '/admin/users')} variant="secondary">
                <Trans i18nKey="org.user-invite-form.back">Back</Trans>
              </LinkButton>
            </Stack>
          </>
        );
      }}
    </Form>
  );
};

export default UserInviteForm;
