import React, { PureComponent } from 'react';
import _ from 'lodash';
import { DashboardModel } from '../../state/DashboardModel';
import { getBackendSrv } from '@grafana/runtime';
import { DateTimeInput } from '@grafana/data';
import { Spinner, HorizontalGroup, Checkbox, Button } from '@grafana/ui';

interface Props {
  dashboard: DashboardModel;
}

export interface HistoryListOpts {
  limit: number;
  start: number;
}

export interface RevisionsModel {
  id: number;
  checked: boolean;
  dashboardId: number;
  parentVersion: number;
  version: number;
  created: Date;
  createdBy: string;
  message: string;
}

export interface CalculateDiffOptions {
  new: DiffTarget;
  base: DiffTarget;
  diffType: string;
}

export interface DiffTarget {
  dashboardId: number;
  version: number;
  unsavedDashboard?: DashboardModel; // when doing diffs against unsaved dashboard version
}

type State = {
  canCompare: boolean;
  isLoading: boolean;
  versions: RevisionsModel[];
  viewMode: 'list' | 'compare';
};

export class VersionsSettings extends PureComponent<Props, State> {
  limit: number;
  start: number;

  constructor(props: Props) {
    super(props);
    this.limit = 10;
    this.start = 0;
    this.state = {
      canCompare: false,
      isLoading: true,
      versions: [],
      viewMode: 'list',
    };
  }

  componentDidMount() {
    this.getVersions(this.props.dashboard, { limit: this.limit, start: this.start }).then(res => {
      this.setState({
        isLoading: false,
        versions: [...this.state.versions, ...this.decorateVersions(res)],
      });
      this.start += this.limit;
    });
  }

  formatDate(date: DateTimeInput) {
    return this.props.dashboard.formatDate(date);
  }

  formatBasicDate(date: DateTimeInput) {
    return this.props.dashboard.getRelativeTime(date);
  }

  decorateVersions = (versions: RevisionsModel[]) =>
    versions.map(version => ({
      ...version,
      createdDateString: this.formatDate(version.created),
      ageString: this.formatBasicDate(version.created),
      checked: false,
    }));

  isLastPage() {
    return _.find(this.state.versions, rev => rev.version === 1);
  }

  getVersions(dashboard: DashboardModel, options: HistoryListOpts) {
    const id = dashboard && dashboard.id ? dashboard.id : void 0;
    return id ? getBackendSrv().get(`api/dashboards/id/${id}/versions`, options) : Promise.resolve([]);
  }

  calculateDiff(options: CalculateDiffOptions) {
    return getBackendSrv().post('api/dashboards/calculate-diff', options);
  }

  restoreDashboard(dashboard: DashboardModel, version: number) {
    const id = dashboard && dashboard.id ? dashboard.id : void 0;
    const url = `api/dashboards/id/${id}/restore`;

    return id && _.isNumber(version) ? getBackendSrv().post(url, { version }) : Promise.resolve({});
  }

  renderHeader = () => {
    return <h3 className="dashboard-settings__header">Versions</h3>;
  };

  renderTable = () => {
    return (
      <table className="filter-table">
        <thead>
          <tr>
            <th className="width-4"></th>
            <th className="width-4">Version</th>
            <th className="width-14">Date</th>
            <th className="width-10">Updated By</th>
            <th>Notes</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {this.state.versions.map(version => (
            <tr key={version.id}>
              <td>
                <div>
                  <Checkbox checked={version.checked} onChange={ev => console.log(ev.currentTarget.checked)} />
                </div>
              </td>
              <td>{version.version}</td>
              <td>{version.createdDateString}</td>
              <td>{version.createdBy}</td>
              <td>{version.message}</td>
              <td className="text-right">
                <Button variant="secondary" size="sm" icon="history" onClick={() => console.log('restore')}>
                  Restore
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  render() {
    return (
      <div>
        {this.renderHeader()}
        {this.state.isLoading ? (
          <HorizontalGroup>
            <Spinner />
            <em>Fetching history list&hellip;</em>
          </HorizontalGroup>
        ) : (
          this.renderTable()
        )}
        <div className="gf-form-group">
          <div className="gf-form-button-row">
            {this.state.versions.length >= this.limit && (
              <Button
                type="button"
                onClick={() => console.log('get more versions')}
                variant="secondary"
                disabled={!!this.isLastPage()}
              >
                Show more versions
              </Button>
            )}
            {this.state.versions.length > 1 && (
              // TODO: add a tooltip!
              // bs-tooltip="ctrl.canCompare ? '' : 'Select 2 versions to start comparing'"
              // data-placement="bottom"
              <Button
                type="button"
                disabled={!this.state.canCompare}
                onClick={() => console.log('display diff view')}
                icon="code-branch"
              >
                Compare versions
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
