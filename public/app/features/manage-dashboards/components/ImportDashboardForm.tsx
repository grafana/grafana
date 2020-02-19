import React, { FormEvent, PureComponent } from 'react';
import { connect } from 'react-redux';
import { Forms } from '@grafana/ui';
import { dateTime } from '@grafana/data';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import DataSourcePicker from 'app/core/components/Select/DataSourcePicker';
import { changeDashboardTitle, resetDashboard } from '../state/actions';
import { DashboardSource, StoreState } from '../../../types';

interface Props {
  dashboard: any;
  inputs: any[];
  source: DashboardSource;
  meta?: any;

  resetDashboard: typeof resetDashboard;
  changeDashboardTitle: typeof changeDashboardTitle;
}

class ImportDashboardForm extends PureComponent<Props> {
  onSubmit = () => {};

  onCancel = () => {
    this.props.resetDashboard();
  };

  onTitleChange = (event: FormEvent<HTMLInputElement>) => {
    this.props.changeDashboardTitle(event.currentTarget.value);
  };

  onFolderChange = ($folder: { title: string; id: number }) => {};

  render() {
    const { dashboard, inputs, meta, source } = this.props;

    return (
      <>
        {source === DashboardSource.Gcom && (
          <>
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
                  <td>{dateTime(meta.updatedAt).format()}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
        <Forms.Form onSubmit={this.onSubmit}>
          {({ register, control, errors }) => {
            return (
              <>
                <Forms.Legend className="section-heading">Options</Forms.Legend>
                <Forms.Field label="Name">
                  <Forms.Input size="md" type="text" value={dashboard.title} onChange={this.onTitleChange} />
                </Forms.Field>
                <Forms.Field label="Folder">
                  <FolderPicker onChange={this.onFolderChange} useInNextGenForms={true} initialFolderId={0} />
                </Forms.Field>
                <Forms.Field
                  label="Unique identifier (uid)"
                  description="The unique identifier (uid) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs.
                The uid allows having consistent URL’s for accessing dashboards so changing the title of a dashboard will not break any
                bookmarked links to that dashboard."
                >
                  <Forms.Input
                    size="md"
                    value="Value set"
                    onChange={() => console.log('change')}
                    disabled
                    addonAfter={<Forms.Button>Clear</Forms.Button>}
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
                <div>
                  <Forms.Button type="submit" variant="primary" onClick={this.onSubmit}>
                    Import
                  </Forms.Button>
                  <Forms.Button type="reset" variant="secondary" onClick={this.onCancel}>
                    Cancel
                  </Forms.Button>
                </div>
              </>
            );
          }}
        </Forms.Form>
      </>
    );
  }
}

const mapStateToProps = (state: StoreState) => {
  const source = state.importDashboard.source;

  return {
    dashboard:
      source === DashboardSource.Gcom
        ? state.importDashboard.gcomDashboard.dashboard
        : state.importDashboard.jsonDashboard,
    meta: state.importDashboard.gcomDashboard.meta,
    source,
    inputs: state.importDashboard.inputs,
  };
};

const mapDispatchToProps = {
  changeDashboardTitle,
  resetDashboard,
};

export default connect(mapStateToProps, mapDispatchToProps)(ImportDashboardForm);
