// import { NavModel } from '@grafana/data';
import { ConnectionConfig } from '@grafana/aws-sdk';
import { KeyValue } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Button, Field, FieldSet, Form, Input, Select } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';
import React, { PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { CustomFieldsEditor } from './CustomFieldsEditor';
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

interface State {
  name: string;
  type?: 'aws' | 'azure' | 'gcp' | 'custom' | undefined;
  jsonData: any;
  secureJsonData: any;
  secureJsonFields: KeyValue<boolean>;
}

export class LibraryCredentialUnconnected extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
  }

  componentDidMount() {
    this.props.loadLibraryCredentials();
  }

  componentDidUpdate() {
    if (this.props.hasFetched && this.state === null) {
      const existingCredential = this.props.libraryCredentials.find(({ id }) => id === this.props.libraryCredentialId);
      existingCredential && this.setState({ ...(this.state as any), ...existingCredential });
    }
  }

  // edit and create should probably be put in redux as well for consistency?
  edit = async () => {
    const result = await getBackendSrv().put(`/api/library-credentials/${this.props.libraryCredentialId}`, this.state);
    if (result.id) {
      locationService.push(`/org/librarycredentials`);
    }
  };

  create = async () => {
    const result = await getBackendSrv().post('/api/library-credentials', this.state);
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

    const connectionConfigProps: any = {
      onOptionsChange: (awsDataSourceSettings: any) => {
        this.setState({
          ...this.state,
          secureJsonData: { ...this.state?.secureJsonData, ...awsDataSourceSettings.secureJsonData },
          jsonData: { ...this.state?.jsonData, ...awsDataSourceSettings.jsonData },
        });
      },
      options: {
        jsonData: {
          ...this.state?.jsonData,
        },
        secureJsonFields: {
          ...this.state?.secureJsonFields,
        },
        secureJsonData: {
          ...this.state?.secureJsonData,
        },
      },
    };

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <Form
            onSubmit={onSubmit}
            defaultValues={{
              name: this.state?.name ? this.state.name : '',
              type: this.state?.type ? this.state.type : 'aws',
            }}
          >
            {() => (
              <FieldSet label={`${formAction} Library Credential`}>
                <Field label="Name">
                  <Input
                    value={this.state?.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      this.setState({ ...this.state, name: e.target.value });
                    }}
                    width={60}
                  />
                </Field>
                <Field label="Type">
                  <Select
                    options={[
                      { label: 'AWS plugin', value: 'aws' },
                      { label: 'Azure plugin', value: 'azure' },
                      { label: 'GCP plugin', value: 'gcp' },
                      { label: 'Custom', value: 'custom' },
                    ]}
                    value={this.state?.type}
                    onChange={({ value }) => {
                      value && this.setState({ ...this.state, type: value as any });
                    }}
                  ></Select>
                </Field>

                {this.state?.type === 'aws' && <ConnectionConfig {...connectionConfigProps}></ConnectionConfig>}

                {this.state?.type === 'custom' && (
                  <CustomFieldsEditor
                    jsonData={this.state?.jsonData}
                    secureJsonFields={this.state?.secureJsonFields}
                    onJsonDataChange={(jsonData: any) =>
                      this.setState({
                        ...this.state,
                        jsonData,
                      })
                    }
                    onSecureJsonDataChange={(secureJsonData: any) =>
                      this.setState({
                        ...this.state,
                        secureJsonData,
                      })
                    }
                    onSecureJsonFieldsChange={(secureJsonFields: any) =>
                      this.setState({
                        ...this.state,
                        secureJsonFields,
                      })
                    }
                  ></CustomFieldsEditor>
                )}

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
