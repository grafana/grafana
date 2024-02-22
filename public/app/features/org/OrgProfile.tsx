import React from 'react';
import { useForm } from 'react-hook-form';

import { Input, Field, FieldSet, Button } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';

export interface Props {
  orgName: string;
  onSubmit: (orgName: string) => void;
}

interface FormDTO {
  orgName: string;
}

const OrgProfile = ({ onSubmit, orgName }: Props) => {
  const canWriteOrg = contextSrv.hasPermission(AccessControlAction.OrgsWrite);
  const initialFormModel: FormDTO = { orgName };

  const { handleSubmit, register } = useForm<FormDTO>({ defaultValues: initialFormModel });

  return (
    <form name="organizationProfile" onSubmit={handleSubmit((form) => onSubmit(form.orgName))}>
      <FieldSet label="Organization profile" disabled={!canWriteOrg}>
        <Field label="Organization name">
          <Input id="org-name-input" type="text" {...register('orgName', { required: true })} />
        </Field>

        <Button type="submit">Update organization name</Button>
      </FieldSet>
    </form>
  );
};

export default OrgProfile;
