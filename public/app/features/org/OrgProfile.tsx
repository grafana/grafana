import { Input, Field, FieldSet, Button } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { contextSrv } from 'app/core/core';
import { t } from 'app/core/internationalization';
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
        <FieldSet label={t('org-profile.title', 'Organization profile')} disabled={!canWriteOrg}>
          <Field label={t('org-profile.name', 'Organization name')}>
            <Input id="org-name-input" type="text" {...register('orgName', { required: true })} />
          </Field>

          <Button type="submit">{t('org-profile.update-name-button', 'Update organization name')}</Button>
        </FieldSet>
      )}
    </Form>
  );
};

export default OrgProfile;
