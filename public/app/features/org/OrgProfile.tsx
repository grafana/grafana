import { Input, Field, FieldSet } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
// import { contextSrv } from 'app/core/core';
// import { AccessControlAction } from 'app/types';
import { t } from 'app/core/internationalization';

export interface Props {
  orgName: string;
  onSubmit: (orgName: string) => void;
}

interface FormDTO {
  orgName: string;
}

const OrgProfile = ({ onSubmit, orgName }: Props) => {
  // BMC code - next line
  //const canWriteOrg = contextSrv.hasPermission(AccessControlAction.OrgsWrite);

  return (
    <Form defaultValues={{ orgName }} onSubmit={({ orgName }: FormDTO) => onSubmit(orgName)}>
      {({ register }) => (
        // BMC code - inline change
        <FieldSet label={t('bmcgrafana.shared-preferences.org.title', 'Organization profile')} disabled>
          <Field label={t('bmcgrafana.shared-preferences.org.org-name-text', 'Organization name')}>
            <Input id="org-name-input" type="text" {...register('orgName', { required: true })} />
          </Field>

          {/* BMC code - next line */}
          {/* <Button type="submit">Update organization name</Button> */}
        </FieldSet>
      )}
    </Form>
  );
};

export default OrgProfile;
