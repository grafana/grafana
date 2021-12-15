import React, { FC } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import Page from 'app/core/components/Page/Page';
import { Button, Input, Field, Form } from '@grafana/ui';
import { StoreState } from 'app/types';
import { connect, ConnectedProps } from 'react-redux';
import { getNavModel } from '../../core/selectors/navModel';
import { createOrganization } from './state/actions';

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

const mapStateToProps = (state: StoreState) => {
  return { navModel: getNavModel(state.navIndex, 'global-orgs') };
};

const mapDispatchToProps = {
  createOrganization,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

interface CreateOrgFormDTO {
  name: string;
}

export const NewOrgPage: FC<Props> = ({ navModel, createOrganization }) => {
  const createOrg = (newOrg: { name: string }) => {
    createOrganization(newOrg);
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h3 className="page-sub-heading">New organization</h3>

        <p className="playlist-description">
          Each organization contains their own dashboards, data sources, and configuration, which cannot be shared
          shared between organizations. While users might belong to more than one organization, multiple organizations
          are most frequently used in multi-tenant deployments.{' '}
        </p>

        <Form<CreateOrgFormDTO> onSubmit={createOrg}>
          {({ register, errors }) => {
            return (
              <>
                <Field label="Organization name" invalid={!!errors.name} error={errors.name && errors.name.message}>
                  <Input
                    placeholder="Org name"
                    {...register('name', {
                      required: 'Organization name is required',
                      validate: async (orgName) => await validateOrg(orgName),
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

export default connector(NewOrgPage);
