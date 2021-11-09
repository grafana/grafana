import React, { FC } from 'react';
import { Input, Field, FieldSet, Button, Form } from '@grafana/ui';
import { Trans } from '@lingui/macro';

export interface Props {
  orgName: string;
  onSubmit: (orgName: string) => void;
}

interface FormDTO {
  orgName: string;
}

const OrgProfile: FC<Props> = ({ onSubmit, orgName }) => {
  return (
    <Form defaultValues={{ orgName }} onSubmit={({ orgName }: FormDTO) => onSubmit(orgName)}>
      {({ register }) => (
        <FieldSet label={<Trans id="settings.org-profile-title">Organization profile</Trans>}>
          <Field label="Organization name">
            <Input id="org-name-input" type="text" {...register('orgName', { required: true })} />
          </Field>

          <Button type="submit">Update organization name</Button>
        </FieldSet>
      )}
    </Form>
  );
};

export default OrgProfile;
