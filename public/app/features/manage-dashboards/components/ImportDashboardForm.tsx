import React, { FormEvent, PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { Forms, HorizontalGroup } from '@grafana/ui';
import { dateTime } from '@grafana/data';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import DataSourcePicker from 'app/core/components/Select/DataSourcePicker';
import { resetDashboard, saveDashboard, validateUid, validateDashboardTitle } from '../state/actions';
import { DashboardSource } from '../state/reducers';
import { StoreState } from '../../../types';

interface ImportDashboardDTO {
  title: string;
  uid: string;
  gnetId: string;
  folderId: number;
}

interface OwnProps {}

interface ConnectedProps {
  dashboard: ImportDashboardDTO;
  inputs: any[];
  source: DashboardSource;
  uidExists: boolean;
  uidError: string;
  titleExists: boolean;
  titleErrorMessage: string;
  meta?: any;
}

interface DispatchProps {
  resetDashboard: typeof resetDashboard;
  validateDashboardTitle: typeof validateDashboardTitle;
  saveDashboard: typeof saveDashboard;
  validateUid: typeof validateUid;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

interface State {
  folderId: number;
  uidReset: boolean;
}

class ImportDashboardFormUnConnected extends PureComponent<Props, State> {
  state: State = {
    folderId: 0,
    uidReset: false,
  };

  onSubmit = (form: ImportDashboardDTO) => {
    this.props.saveDashboard(form.title, form.uid, this.state.folderId);
  };

  onCancel = () => {
    this.props.resetDashboard();
  };

  onTitleChange = (event: FormEvent<HTMLInputElement>) => {
    this.props.validateDashboardTitle(event.currentTarget.value);
  };

  validateUid = (event: FormEvent<HTMLInputElement>) => {
    this.props.validateUid(event.currentTarget.value);
  };

  onUidReset = () => {
    this.setState({ uidReset: true });
  };

  render() {
    const { dashboard, inputs, meta, source, uidExists, uidError, titleExists, titleErrorMessage } = this.props;
    const { uidReset } = this.state;

    const buttonVariant = uidExists || titleExists ? 'destructive' : 'primary';
    const buttonText = uidExists || titleExists ? 'Import (Overwrite)' : 'Import';

    return (
      <>
        {source === DashboardSource.Gcom && (
          <div style={{ marginBottom: '24px' }}>
            <div>
              <Forms.Legend>
                Importing Dashboard from{' '}
                <a
                  href={`https://grafana.com/dashboards/${dashboard.gnetId}`}
                  className="external-link"
                  target="_blank"
                >
                  Grafana.com
                </a>
              </Forms.Legend>
            </div>
            <table className="filter-table form-inline">
              <tbody>
                <tr>
                  <td>Published by</td>
                  <td>{meta.orgName}</td>
                </tr>
                <tr>
                  <td>Updated on</td>
                  <td>{dateTime(meta.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <Forms.Form onSubmit={this.onSubmit} defaultValues={dashboard}>
          {({ register, errors, control }) => {
            const titleError = (titleExists && titleErrorMessage) || (!!errors.title && 'Title is required');

            return (
              <>
                <Forms.Legend>Options</Forms.Legend>
                <Forms.Field label="Name" invalid={titleExists || !!errors.title} error={titleError}>
                  <Forms.Input
                    name="title"
                    size="md"
                    type="text"
                    ref={register({ required: true })}
                    onChange={this.onTitleChange}
                  />
                </Forms.Field>
                <Forms.Field label="Folder">
                  <Forms.InputControl
                    as={FolderPicker}
                    name="folderId"
                    useNewForms
                    initialFolderId={0}
                    control={control}
                  />
                </Forms.Field>
                <Forms.Field
                  label="Unique identifier (uid)"
                  description="The unique identifier (uid) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs.
                The uid allows having consistent URL’s for accessing dashboards so changing the title of a dashboard will not break any
                bookmarked links to that dashboard."
                  invalid={uidExists}
                  error={uidError}
                >
                  <Forms.Input
                    size="md"
                    onChange={this.validateUid}
                    defaultValue={!uidReset && 'Value set'}
                    disabled={!uidReset}
                    name="uid"
                    ref={register({ required: true })}
                    addonAfter={!this.state.uidReset && <Forms.Button onClick={this.onUidReset}>Clear</Forms.Button>}
                  />
                </Forms.Field>
                {inputs.map((input: any, index: number) => {
                  if (input.type === 'datasource') {
                    return (
                      <Forms.Field label={input.label} key={`${input.label}-${index}`}>
                        <DataSourcePicker
                          datasources={input.options}
                          onChange={() => console.log('something changed')}
                          current={input.options[0]}
                        />
                      </Forms.Field>
                    );
                  }
                  return null;
                })}
                <HorizontalGroup>
                  <Forms.Button type="submit" variant={buttonVariant}>
                    {buttonText}
                  </Forms.Button>
                  <Forms.Button type="reset" variant="secondary" onClick={this.onCancel}>
                    Cancel
                  </Forms.Button>
                </HorizontalGroup>
              </>
            );
          }}
        </Forms.Form>
      </>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state: StoreState) => ({
  dashboard: state.importDashboard.dashboard,
  meta: state.importDashboard.meta,
  source: state.importDashboard.source,
  inputs: state.importDashboard.inputs,
  uidExists: state.importDashboard.uidExists,
  uidError: state.importDashboard.uidError,
  titleExists: state.importDashboard.titleExists,
  titleErrorMessage: state.importDashboard.titleErrorMessage,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  validateDashboardTitle,
  resetDashboard,
  saveDashboard,
  validateUid,
};

export const ImportDashboardForm = connect(mapStateToProps, mapDispatchToProps)(ImportDashboardFormUnConnected);
ImportDashboardForm.displayName = 'ImportDashboardForm';
