import React, { useCallback } from 'react';
import { connect } from 'react-redux';
import { Form, Button, Input, Field } from '@grafana/ui';
import { NavModel } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { StoreState } from '../../types';
import { getNavModel } from '../../core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import { useHistory } from 'react-router-dom';

interface ServiceAccountCreatePageProps {
  navModel: NavModel;
}
interface ServiceAccountDTO {
  name: string;
}

const createServiceAccount = async (sa: ServiceAccountDTO) => getBackendSrv().post('/api/serviceaccounts/', sa);

const ServiceAccountCreatePage: React.FC<ServiceAccountCreatePageProps> = ({ navModel }) => {
  const history = useHistory();

  const onSubmit = useCallback(
    async (data: ServiceAccountDTO) => {
      await createServiceAccount(data);
      history.push('/org/serviceaccounts/');
    },
    [history]
  );

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <h1>Create service account</h1>
        <Form onSubmit={onSubmit} validateOn="onBlur">
          {({ register, errors }) => {
            return (
              <>
                <Field
                  label="Display name"
                  required
                  invalid={!!errors.name}
                  error={errors.name ? 'Display name is required' : undefined}
                >
                  <Input id="display-name-input" {...register('name', { required: true })} />
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

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'serviceaccounts'),
});

export default connect(mapStateToProps)(ServiceAccountCreatePage);
