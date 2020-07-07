import React, { FC } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import Page from 'app/core/components/Page/Page';
import { Button, Input, Field, Form } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { StoreState } from 'app/types';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModel } from '@grafana/data';
import { getNavModel } from '../../core/selectors/navModel';

const createOrg = async (newOrg: { name: string }) => {
  const result = await getBackendSrv().post('/api/orgs/', newOrg);

  await getBackendSrv().post('/api/user/using/' + result.orgId);
  window.location.href = getConfig().appSubUrl + '/org';
};

const validateOrg = async (orgName: string) => {
  try {
    await getBackendSrv().get(`api/orgs/name/${encodeURI(orgName)}`);
  } catch (error) {
    if (error.status === 404) {
      error.isHandled = true;
      return true;
    }
    return 'Something went wrong';
  }
  return 'Organization already exists';
};

interface PropsWithState {
  navModel: NavModel;
}

interface CreateOrgFormDTO {
  name: string;
}

export const NewOrgPage: FC<PropsWithState> = ({ navModel }) => {
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h3 className="page-sub-heading">New Organization</h3>

        <p className="playlist-description">
          Each organization contains their own dashboards, data sources and configuration, and cannot be shared between
          orgs. While users may belong to more than one, multiple organization are most frequently used in multi-tenant
          deployments.{' '}
        </p>

        <Form<CreateOrgFormDTO> onSubmit={createOrg}>
          {({ register, errors }) => {
            return (
              <>
                <Field label="Organization name" invalid={!!errors.name} error={errors.name && errors.name.message}>
                  <Input
                    placeholder="Org. name"
                    name="name"
                    ref={register({
                      required: 'Organization name is required',
                      validate: async orgName => await validateOrg(orgName),
                    })}
                  />
                </Field>
                <Button type="submit">Create</Button>
              </>
            );
          }}
        </Form>
      </Page.Contents>
    </Page>
  );
};

const mapStateToProps = (state: StoreState) => {
  return { navModel: getNavModel(state.navIndex, 'global-orgs') };
};

export default hot(module)(connect(mapStateToProps)(NewOrgPage));
