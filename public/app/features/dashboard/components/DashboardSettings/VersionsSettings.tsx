import React, { PureComponent } from 'react';
import _ from 'lodash';
import { Spinner, HorizontalGroup, Checkbox, Button, Tag } from '@grafana/ui';
import DangerouslySetHtmlContent from 'dangerously-set-html-content';
import { DashboardModel } from '../../state/DashboardModel';
import { historySrv, RevisionsModel, CalculateDiffOptions } from '../VersionHistory/HistorySrv';

interface Props {
  dashboard: DashboardModel;
}

type State = {
  isLoading: boolean;
  isAppending: boolean;
  versions: DecoratedRevisionModel[];
  viewMode: 'list' | 'compare';
  delta: { basic: string; json: string };
};

type DecoratedRevisionModel = RevisionsModel & {
  createdDateString: string;
  ageString: string;
  checked: boolean;
};

export class VersionsSettings extends PureComponent<Props, State> {
  limit: number;
  start: number;

  constructor(props: Props) {
    super(props);
    this.limit = 10;
    this.start = 0;
    this.state = {
      isLoading: true,
      isAppending: true,
      versions: [],
      viewMode: 'list',
      delta: {
        basic: '',
        json: '',
      },
    };
  }

  componentDidMount() {
    this.getVersions();
  }

  getVersions = (append = false) => {
    this.setState({ isAppending: append });
    historySrv
      .getHistoryList(this.props.dashboard, { limit: this.limit, start: this.start })
      .then(res => {
        this.setState({
          isLoading: false,
          versions: [...this.state.versions, ...this.decorateVersions(res)],
        });
        this.start += this.limit;
      })
      .catch(err => console.log(err))
      .finally(() => this.setState({ isAppending: false }));
  };

  getDiff = (diff = 'basic') => {
    this.setState({ viewMode: 'compare', isLoading: true });

    const selectedVersions = this.state.versions.filter(version => version.checked);
    const newInfo = selectedVersions[0];
    const baseInfo = selectedVersions[1];
    // TODO: isNewLatest needs workering.
    const isNewLatest = newInfo.version === this.props.dashboard.version;
    const options: CalculateDiffOptions = {
      new: {
        dashboardId: this.props.dashboard.id,
        version: newInfo.version,
      },
      base: {
        dashboardId: this.props.dashboard.id,
        version: baseInfo.version,
      },
      diffType: diff,
    };

    return historySrv
      .calculateDiff(options)
      .then((response: any) => {
        // @ts-ignore
        this.setState({
          delta: {
            [diff]: response,
          },
        });
      })
      .catch(() => {
        this.setState({
          viewMode: 'list',
        });
      })
      .finally(() => {
        this.setState({
          isLoading: false,
        });
      });
  };

  decorateVersions = (versions: RevisionsModel[]) =>
    versions.map(version => ({
      ...version,
      createdDateString: this.props.dashboard.formatDate(version.created),
      ageString: this.props.dashboard.getRelativeTime(version.created),
      checked: false,
    }));

  isLastPage() {
    return _.find(this.state.versions, rev => rev.version === 1);
  }

  handleCheck = (ev: React.FormEvent<HTMLInputElement>, versionId: number) => {
    this.setState({
      versions: this.state.versions.map(version =>
        version.id === versionId ? { ...version, checked: ev.currentTarget.checked } : version
      ),
    });
  };

  setViewMode = () => {
    this.setState({
      viewMode: 'list',
    });
  };

  render() {
    const canCompare = this.state.versions.filter(version => version.checked).length !== 2;
    const hasVersions = this.state.versions.length > 1;
    const hasMore = this.state.versions.length >= this.limit;

    if (this.state.viewMode === 'compare') {
      return (
        <div>
          <VersionsHeader />
          {this.state.isLoading ? (
            <VersionsSpinner msg="Fetching changes&hellip;" />
          ) : (
            <VersionsDiff delta={this.state.delta} />
          )}
        </div>
      );
    }

    return (
      <div>
        <VersionsHeader />
        {this.state.isLoading ? (
          <VersionsSpinner msg="Fetching history list&hellip;" />
        ) : (
          <VersionsTable versions={this.state.versions} handleCheck={this.handleCheck} />
        )}
        {this.state.isAppending && <VersionsSpinner msg="Fetching more entries&hellip;" />}
        <VersionsButtons
          hasMore={hasMore}
          hasVersions={hasVersions}
          canCompare={canCompare}
          getVersions={this.getVersions}
          getDiff={this.getDiff}
          isLastPage={!!this.isLastPage()}
        />
      </div>
    );
  }
}

const VersionsSpinner = ({ msg }: { msg: string }) => (
  <HorizontalGroup>
    <Spinner />
    <em>{msg}</em>
  </HorizontalGroup>
);

const VersionsButtons = ({
  hasMore,
  hasVersions,
  canCompare,
  getVersions,
  getDiff,
  isLastPage,
}: {
  hasMore: boolean;
  hasVersions: boolean;
  canCompare: boolean;
  getVersions: (append: boolean) => void;
  getDiff: () => void;
  isLastPage: boolean;
}) => (
  <div className="gf-form-group">
    <div className="gf-form-button-row">
      {hasMore && (
        <Button type="button" onClick={() => getVersions(true)} variant="secondary" disabled={isLastPage}>
          Show more versions
        </Button>
      )}
      {hasVersions && (
        // TODO: add a tooltip!
        // bs-tooltip="ctrl.canCompare ? '' : 'Select 2 versions to start comparing'"
        // data-placement="bottom"
        <Button type="button" disabled={canCompare} onClick={() => getDiff()} icon="code-branch">
          Compare versions
        </Button>
      )}
    </div>
  </div>
);

const VersionsHeader = () => <h3 className="dashboard-settings__header">Versions</h3>;

const VersionsTable = ({ versions, handleCheck }: { versions: DecoratedRevisionModel[]; handleCheck: any }) => (
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
      {versions.map((version, idx) => (
        <tr key={version.id}>
          <td>
            <div>
              <Checkbox checked={version.checked} onChange={ev => handleCheck(ev, version.id)} />
            </div>
          </td>
          <td>{version.version}</td>
          <td>{version.createdDateString}</td>
          <td>{version.createdBy}</td>
          <td>{version.message}</td>
          <td className="text-right">
            {idx === 0 ? (
              <Tag name="Latest" colorIndex={17} />
            ) : (
              <Button variant="secondary" size="sm" icon="history" onClick={() => console.log('restore')}>
                Restore
              </Button>
            )}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const VersionsDiff = ({ delta }) => {
  return (
    <div>
      <div className="delta-basic">
        <DangerouslySetHtmlContent html={delta.basic} />
      </div>
    </div>
  );
};
