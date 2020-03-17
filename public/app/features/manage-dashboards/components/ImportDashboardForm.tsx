import React, { PureComponent } from 'react';
import { connect, MapDispatchToProps, MapStateToProps } from 'react-redux';
import { Forms, HorizontalGroup } from '@grafana/ui';
import { dateTime } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import DataSourcePicker from 'app/core/components/Select/DataSourcePicker';
import { resetDashboard, saveDashboard } from '../state/actions';
import { DashboardSource } from '../state/reducers';
import { StoreState } from 'app/types';
import validationSrv from '../services/ValidationSrv';

interface ImportDashboardDTO {
  title: string;
  uid: string;
  gnetId: string;
  folderId?: number;
  inputs: Array<{ name: string; label: string; info: string; type: string; pluginId: string }>;
}

interface OwnProps {}

interface ConnectedProps {
  dashboard: ImportDashboardDTO;
  inputs: any[];
  source: DashboardSource;
  meta?: any;
  folderId?: number;
}

interface DispatchProps {
  resetDashboard: typeof resetDashboard;
  saveDashboard: typeof saveDashboard;
}

type Props = OwnProps & ConnectedProps & DispatchProps;

interface State {
  folderId: number;
  uidReset: boolean;
  titleExists: boolean;
  uidExists: boolean;
}

class ImportDashboardFormUnConnected extends PureComponent<Props, State> {
  state: State = {
    folderId: 0,
    uidReset: false,
    titleExists: false,
    uidExists: false,
  };

  onSubmit = (form: ImportDashboardDTO) => {
    this.props.saveDashboard(form.title, form.uid, this.state.folderId);
  };

  onCancel = () => {
    this.props.resetDashboard();
  };

  validateTitle = (newTitle: string) => {
    const { folderId } = this.state;
    console.log('poke1');
    return validationSrv
      .validateNewDashboardName(folderId, newTitle)
      .then(() => {
        return true;
      })
      .catch(error => {
        if (error.type === 'EXISTING') {
          return error.message;
        }
      });
  };

  validateUid = (value: string) => {
    return getBackendSrv()
      .get(`/api/dashboards/uid/${value}`)
      .then(existingDashboard => {
        return `Dashboard named '${existingDashboard?.dashboard.title}' in folder '${existingDashboard?.meta.folderTitle}' has the same uid`;
      })
      .catch(error => {
        error.isHandled = true;
        return false;
      });
  };

  onUidReset = () => {
    this.setState({ uidReset: true });
  };

  render() {
    const { dashboard, inputs, meta, source } = this.props;
    const { uidReset, titleExists, uidExists } = this.state;

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
        <Forms.Form onSubmit={this.onSubmit} defaultValues={dashboard} validateOnMount>
          {({ register, errors, control }) => {
            return (
              <>
                <Forms.Legend>Options</Forms.Legend>
                <Forms.Field label="Name" invalid={!!errors.title} error={errors.title && errors.title.message}>
                  <Forms.Input
                    name="title"
                    size="md"
                    type="text"
                    ref={register({ required: 'Name is required', validate: async v => await this.validateTitle(v) })}
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
                  invalid={!!errors.uid}
                  error={errors.uid && errors.uid.message}
                >
                  <>
                    {!uidReset ? (
                      <Forms.Input
                        size="md"
                        name="uid"
                        disabled
                        ref={register({ validate: async v => await this.validateUid(v) })}
                        addonAfter={
                          !this.state.uidReset && <Forms.Button onClick={this.onUidReset}>Change uid</Forms.Button>
                        }
                      />
                    ) : (
                      <Forms.Input
                        size="md"
                        name="uid"
                        ref={register({ required: true, validate: async v => await this.validateUid(v) })}
                      />
                    )}
                  </>
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
  folderId: state.location.routeParams.folderId ? Number(state.location.routeParams.folderId) : 0,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  resetDashboard,
  saveDashboard,
};

export const ImportDashboardForm = connect(mapStateToProps, mapDispatchToProps)(ImportDashboardFormUnConnected);
ImportDashboardForm.displayName = 'ImportDashboardForm';
