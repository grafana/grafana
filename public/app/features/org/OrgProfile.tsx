import { Input, Field, FieldSet, Button } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
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

  return (
    <Form defaultValues={{ orgName }} onSubmit={({ orgName }: FormDTO) => onSubmit(orgName)}>
      {({ register }) => (
        <FieldSet label="Профиль организации" disabled={!canWriteOrg}>
          <Field label="Название организации">
            <Input id="org-name-input" type="text" {...register('orgName', { required: true })} />
          </Field>

          <Button type="submit">Обновить название организации</Button>
        </FieldSet>
      )}
    </Form>
  );
};

export default OrgProfile;
