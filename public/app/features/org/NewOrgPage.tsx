import { connect, ConnectedProps } from 'react-redux';

import { NavModelItem } from '@grafana/data';
import { Button, Input, Field, FieldSet } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';
import { Page } from 'app/core/components/Page/Page';
import { getConfig } from 'app/core/config';
import { t, Trans } from 'app/core/internationalization';

import { createOrganization } from './state/actions';

const mapDispatchToProps = {
  createOrganization,
};

const connector = connect(undefined, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

interface CreateOrgFormDTO {
  name: string;
}

const pageNav: NavModelItem = {
  icon: 'building',
  id: 'org-new',
  text: 'New organization',
};

export const NewOrgPage = ({ createOrganization }: Props) => {
  const createOrg = async (newOrg: { name: string }) => {
    await createOrganization(newOrg);
    window.location.href = getConfig().appSubUrl + '/org';
  };

  return (
    <Page navId="global-orgs" pageNav={pageNav}>
      <Page.Contents>
        <p className="muted">
          <Trans i18nKey="org.new-org-page.description">
            Each organization contains their own dashboards, data sources, and configuration, which cannot be shared
            shared between organizations. While users might belong to more than one organization, multiple organizations
            are most frequently used in multi-tenant deployments.
          </Trans>
        </p>

        <Form<CreateOrgFormDTO> onSubmit={createOrg}>
          {({ register, errors }) => {
            return (
              <>
                <FieldSet>
                  <Field
                    label={t('org.new-org-page.label-organization-name', 'Organization name')}
                    invalid={!!errors.name}
                    error={errors.name && errors.name.message}
                  >
                    <Input
                      placeholder={t('org.new-org-page.placeholder-org-name', 'Org name')}
                      {...register('name', {
                        required: 'Organization name is required',
                      })}
                    />
                  </Field>
                </FieldSet>
                <Button type="submit">
                  <Trans i18nKey="org.new-org-page.create">Create</Trans>
                </Button>
              </>
            );
          }}
        </Form>
      </Page.Contents>
    </Page>
  );
};

export default connector(NewOrgPage);
