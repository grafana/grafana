// import { NavModel } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Button, Field, FieldSet, Form, Input, Select } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { loadLibraryCredentials } from './state/actions';
import { getLibraryCredentials } from './state/selectors';

interface LibraryCredentialsRouteParams {
  id?: string;
}

interface OwnProps extends GrafanaRouteComponentProps<LibraryCredentialsRouteParams> {}

function mapStateToProps(state: StoreState, props: OwnProps) {
  const libraryCredentialId = props.match.params.id ? parseInt(props.match.params.id, 10) : undefined;

  return {
    navModel: getNavModel(state.navIndex, 'librarycredentials'),
    libraryCredentials: getLibraryCredentials(state.libraryCredentials),
    libraryCredentialId,
    hasFetched: state.libraryCredentials.hasFetched,
  };
}

const mapDispatchToProps = {
  loadLibraryCredentials,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = OwnProps & ConnectedProps<typeof connector>;

interface LibraryCredentialFormInput {
  name: string;
  type: string;
}

interface State {
  name: string;
  type: string;
}

export class LibraryCredentialUnconnected extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    this.props.loadLibraryCredentials();
  }

  // edit and create should probably be put in redux as well for consistency?
  edit = async (formModel: LibraryCredentialFormInput) => {
    const result = await getBackendSrv().put(`/api/library-credentials/${this.props.libraryCredentialId}`, formModel);
    if (result.id) {
      locationService.push(`/org/librarycredentials`);
    }
  };

  create = async (formModel: LibraryCredentialFormInput) => {
    const result = await getBackendSrv().post('/api/library-credentials', formModel);
    if (result.id) {
      locationService.push(`/org/librarycredentials`);
    }
  };

  render() {
    const { navModel, hasFetched } = this.props;
    if (!hasFetched) {
      return (
        <Page navModel={navModel}>
          <Page.Contents isLoading={true}>{}</Page.Contents>
        </Page>
      );
    }

    const onSubmit = this.props.libraryCredentialId ? this.edit : this.create;
    const formAction = this.props.libraryCredentialId ? 'Edit' : 'Create';
    const existingCredential = this.props.libraryCredentials.find(({ id }) => id === this.props.libraryCredentialId);
    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <Form
            onSubmit={onSubmit}
            defaultValues={{
              name: existingCredential ? existingCredential.name : '',
              type: existingCredential ? existingCredential.type : 'aws',
            }}
          >
            {({ register }) => (
              <FieldSet label={`${formAction} Library Credential`}>
                <Field label="Name">
                  <Select
                    options={[
                      { label: 'AWS plugin', value: 'aws' },
                      { label: 'Azure plugin', value: 'azure' },
                      { label: 'GCP plugin', value: 'gcp' },
                      { label: 'Custom', value: 'custom' },
                    ]}
                    value={'aws'}
                    onChange={({ value }) => register('type')}
                  ></Select>
                  {/* <Input {...register('name', { required: true })} id="library-credential-name" width={60} /> */}
                </Field>
                <Field label="Type">
                  <Input {...register('type', { required: true })} id="library-credential-type" width={60} />
                  {/* 
                  TODO on wednesday:
                  - make type a select
                  - render different forms based on type (aws/azure/gcp/custom)
                  - add json and securejson as required to the form
                  - validation? (maybe better left for after hackathon)
                  - start drawing how we want to use these credentials
                 */}
                </Field>
                <div className="gf-form-button-row">
                  <Button type="submit" variant="primary">
                    {formAction}
                  </Button>
                </div>
              </FieldSet>
            )}
          </Form>
        </Page.Contents>
      </Page>
    );
  }
}

const LibraryCredential = connector(LibraryCredentialUnconnected);
export default LibraryCredential;
