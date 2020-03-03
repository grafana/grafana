import React, { FC } from 'react';
import { NavModelSrv } from 'app/core/core';
import { getBackendSrv } from '@grafana/runtime';
import Page from 'app/core/components/Page/Page';
import { Forms } from '@grafana/ui';
import { getConfig } from 'app/core/config';

const createOrg = (newOrg: { name: string }) => {
  getBackendSrv()
    .post('/api/orgs/', newOrg)
    .then((result: any) => {
      getBackendSrv()
        .post('/api/user/using/' + result.orgId)
        .then(() => {
          window.location.href = getConfig().appSubUrl + '/org';
        });
    });
};

export const NewOrgPage: FC = () => {
  const navModel = new NavModelSrv().getNav('admin', 'global-orgs', 0);
  console.log(navModel);
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h3 className="page-sub-heading">New Organization</h3>

        <p className="playlist-description">
          Each organization contains their own dashboards, data sources and configuration, and cannot be shared between
          orgs. While users may belong to more than one, multiple organization are most frequently used in multi-tenant
          deployments.{' '}
        </p>

        <Forms.Form<{ name: string }> onSubmit={createOrg}>
          {({ register, errors }) => {
            return (
              <>
                <Forms.Field
                  label="Organization name"
                  invalid={!!errors.name}
                  error={!!errors.name && errors.name.message}
                >
                  <Forms.Input
                    size="md"
                    placeholder="Org. name"
                    name="name"
                    ref={register({ required: 'Organization name is required' })}
                  />
                </Forms.Field>
                <Forms.Button type="submit">Create</Forms.Button>
              </>
            );
          }}
        </Forms.Form>
      </Page.Contents>
    </Page>
  );
};

export default NewOrgPage;
