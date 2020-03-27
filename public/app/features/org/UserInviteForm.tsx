import React, { FC } from 'react';
import { Forms, HorizontalGroup, Button, LinkButton } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { OrgRole } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { updateLocation } from 'app/core/actions';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { appEvents } from 'app/core/core';
import { AppEvents } from '@grafana/data';
import { assureBaseUrl } from 'app/core/utils/location_util';

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

interface Props {
  updateLocation: typeof updateLocation;
}

export const UserInviteForm: FC<Props> = ({ updateLocation }) => {
  const onSubmit = async (formData: FormModel) => {
    try {
      await getBackendSrv().post('/api/org/invites', formData);
    } catch (err) {
      appEvents.emit(AppEvents.alertError, ['Failed to send invite', err.message]);
    }
    updateLocation({ path: 'org/users/' });
  };
  const defaultValues: FormModel = {
    name: '',
    email: '',
    role: OrgRole.Editor,
    sendEmail: true,
  };

  return (
    <Forms.Form defaultValues={defaultValues} onSubmit={onSubmit}>
      {({ register, control, errors }) => {
        return (
          <>
            <Forms.Field
              invalid={!!errors.loginOrEmail}
              error={!!errors.loginOrEmail && 'Email or Username is required'}
              label="Email or Username"
            >
              <Forms.Input
                size="md"
                name="loginOrEmail"
                placeholder="email@example.com"
                ref={register({ required: true })}
              />
            </Forms.Field>
            <Forms.Field invalid={!!errors.name} label="Name">
              <Forms.Input size="md" name="name" placeholder="(optional)" ref={register} />
            </Forms.Field>
            <Forms.Field invalid={!!errors.role} label="Role">
              <Forms.InputControl as={Forms.RadioButtonGroup} control={control} options={roles} name="role" />
            </Forms.Field>
            <Forms.Field invalid={!!errors.sendEmail} label="Send invite email">
              <Forms.Switch name="sendEmail" ref={register} />
            </Forms.Field>
            <HorizontalGroup>
              <Button type="submit">Submit</Button>
              <LinkButton href={assureBaseUrl(getConfig().appSubUrl + '/org/users')} variant="secondary">
                Back
              </LinkButton>
            </HorizontalGroup>
          </>
        );
      }}
    </Forms.Form>
  );
};

const mapDispatchToProps = {
  updateLocation,
};

export default hot(module)(connect(null, mapDispatchToProps)(UserInviteForm));
