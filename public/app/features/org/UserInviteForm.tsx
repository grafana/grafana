import React, { FC } from 'react';
import {
  HorizontalGroup,
  Button,
  LinkButton,
  Input,
  Switch,
  RadioButtonGroup,
  Form,
  Field,
  InputControl,
} from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { OrgRole } from 'app/types';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { appEvents } from 'app/core/core';
import { AppEvents, locationUtil } from '@grafana/data';

const roles = [
  { label: 'Viewer', value: OrgRole.Viewer },
  { label: 'Editor', value: OrgRole.Editor },
  { label: 'Admin', value: OrgRole.Admin },
];

interface FormModel {
  role: OrgRole;
  name: string;
  loginOrEmail?: string;
  sendEmail: boolean;
  email: string;
}

interface Props {}

export const UserInviteForm: FC<Props> = ({}) => {
  const onSubmit = async (formData: FormModel) => {
    try {
      await getBackendSrv().post('/api/org/invites', formData);
    } catch (err) {
      appEvents.emit(AppEvents.alertError, ['Failed to send invitation.', err.message]);
    }
    locationService.push('/org/users/');
  };

  const defaultValues: FormModel = {
    name: '',
    email: '',
    role: OrgRole.Editor,
    sendEmail: true,
  };

  return (
    <Form defaultValues={defaultValues} onSubmit={onSubmit}>
      {({ register, control, errors }) => {
        return (
          <>
            <Field
              invalid={!!errors.loginOrEmail}
              error={!!errors.loginOrEmail ? 'Email or username is required' : undefined}
              label="Email or username"
            >
              <Input name="loginOrEmail" placeholder="email@example.com" ref={register({ required: true })} />
            </Field>
            <Field invalid={!!errors.name} label="Name">
              <Input name="name" placeholder="(optional)" ref={register} />
            </Field>
            <Field invalid={!!errors.role} label="Role">
              <InputControl as={RadioButtonGroup} control={control} options={roles} name="role" />
            </Field>
            <Field label="Send invite email">
              <Switch name="sendEmail" ref={register} />
            </Field>
            <HorizontalGroup>
              <Button type="submit">Submit</Button>
              <LinkButton href={locationUtil.assureBaseUrl(getConfig().appSubUrl + '/org/users')} variant="secondary">
                Back
              </LinkButton>
            </HorizontalGroup>
          </>
        );
      }}
    </Form>
  );
};

export default UserInviteForm;
