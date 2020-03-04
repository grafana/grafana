import React, { FC } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import Page from 'app/core/components/Page/Page';
import { Forms } from '@grafana/ui';
import { getConfig } from 'app/core/config';
import { StoreState } from 'app/types';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { NavModelItem } from '@grafana/data';

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

interface PropsWithState {
  navModel: NavModelItem;
}

interface CreateOrgFormDTO {
  name: string;
}

export const NewOrgPage: FC<PropsWithState> = ({ navModel }) => {
  return (
    <Page navModel={{ main: navModel.parentItem, node: navModel.parentItem }}>
      <Page.Contents>
        <h3 className="page-sub-heading">New Organization</h3>

        <p className="playlist-description">
          Each organization contains their own dashboards, data sources and configuration, and cannot be shared between
          orgs. While users may belong to more than one, multiple organization are most frequently used in multi-tenant
          deployments.{' '}
        </p>

        <Forms.Form<CreateOrgFormDTO> onSubmit={createOrg}>
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

const mapStateToProps = (state: StoreState) => {
  return { navModel: state.navIndex['global-orgs'] };
};

export default hot(module)(connect(mapStateToProps)(NewOrgPage));
