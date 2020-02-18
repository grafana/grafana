import React, { FC } from 'react';
import { Forms } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { OrgRole } from 'app/types';
import { css } from 'emotion';
import { getBackendSrv } from '@grafana/runtime';

const roles = [
  { label: 'Viewer', value: OrgRole.Viewer },
  { label: 'Editor', value: OrgRole.Editor },
  { label: 'Admin', value: OrgRole.Admin },
];

const buttonSpacing = css`
  margin-left: 15px;
`;

interface FormModel {
  role: OrgRole;
  name: string;
  loginOrEmail?: string;
  sendEmail: boolean;
  email: string;
}

export const UserInviteForm: FC = () => {
  const onSubmit = async (formData: FormModel) => {
    console.log(formData);
    // Make request
    try {
      await getBackendSrv().post('/api/org/invites', formData);
    } catch (err) {
      throw err;
    }
    console.log('redirecting');
  };
  const defaultValues: FormModel = {
    name: '',
    email: '',
    role: OrgRole.Editor,
    sendEmail: true,
  };

  return (
    <Forms.Form defaultValues={defaultValues} onSubmit={onSubmit}>
      {({ register, control }) => {
        return (
          <>
            <Forms.Field label="Email or Username">
              <Forms.Input size="md" name="loginOrEmail" placeholder="email@example.com" ref={register} />
            </Forms.Field>
            <Forms.Field label="Name">
              <Forms.Input size="md" name="name" placeholder="(optional)" ref={register} />
            </Forms.Field>
            <Forms.Field label="Role">
              <Forms.InputControl as={Forms.RadioButtonGroup} control={control} options={roles} name="role" />
            </Forms.Field>
            <Forms.Field label="Send invite email">
              <Forms.Switch name="sendEmail" ref={register} />
            </Forms.Field>
            <Forms.Button type="submit">Submit</Forms.Button>
            <span className={buttonSpacing}>
              <Forms.LinkButton href={getConfig().appSubUrl + '/org/users'} variant="secondary">
                Back
              </Forms.LinkButton>
            </span>
          </>
        );
      }}
    </Forms.Form>
  );
};
