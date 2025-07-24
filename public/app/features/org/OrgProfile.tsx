import { Trans, t } from '@grafana/i18n';
import { Input, Field, FieldSet, Button } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types/accessControl';

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
        <FieldSet
          label={t('org.org-profile.label-organization-profile', 'Organization profile')}
          disabled={!canWriteOrg}
        >
          <Field label={t('org.org-profile.label-organization-name', 'Organization name')}>
            <Input id="org-name-input" type="text" {...register('orgName', { required: true })} />
          </Field>

          <Button type="submit">
            <Trans i18nKey="org.org-profile.update-organization-name">Update organization name</Trans>
          </Button>
        </FieldSet>
      )}
    </Form>
  );
};

export default OrgProfile;
