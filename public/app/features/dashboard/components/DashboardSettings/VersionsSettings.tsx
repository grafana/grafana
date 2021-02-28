import React, { PureComponent } from 'react';
import { Spinner, HorizontalGroup } from '@grafana/ui';
import { DashboardModel } from '../../state/DashboardModel';
import { historySrv, RevisionsModel, CalculateDiffOptions } from '../VersionHistory/HistorySrv';
import { VersionHistoryTable } from '../VersionHistory/VersionHistoryTable';
import { VersionHistoryHeader } from '../VersionHistory/VersionHistoryHeader';
import { VersionsHistoryButtons } from '../VersionHistory/VersionHistoryButtons';
import { VersionHistoryComparison } from '../VersionHistory/VersionHistoryComparison';
interface Props {
  dashboard: DashboardModel;
}

type State = {
  isLoading: boolean;
  isAppending: boolean;
  versions: DecoratedRevisionModel[];
  viewMode: 'list' | 'compare';
  delta: { basic: string; json: string };
  newInfo?: DecoratedRevisionModel;
  baseInfo?: DecoratedRevisionModel;
  isNewLatest: boolean;
};

export type DecoratedRevisionModel = RevisionsModel & {
  createdDateString: string;
  ageString: string;
  checked: boolean;
};

export const VERSIONS_FETCH_LIMIT = 10;

export class VersionsSettings extends PureComponent<Props, State> {
  limit: number;
  start: number;

  constructor(props: Props) {
    super(props);
    this.limit = VERSIONS_FETCH_LIMIT;
    this.start = 0;
    this.state = {
      delta: {
        basic: '',
        json: '',
      },
      isAppending: true,
      isLoading: true,
      versions: [],
      viewMode: 'list',
      isNewLatest: false,
    };
  }

  componentDidMount() {
    this.getVersions();
  }

  getVersions = (append = false) => {
    this.setState({ isAppending: append });
    historySrv
      .getHistoryList(this.props.dashboard, { limit: this.limit, start: this.start })
      .then((res) => {
        this.setState({
          isLoading: false,
          versions: [...this.state.versions, ...this.decorateVersions(res)],
        });
        this.start += this.limit;
      })
      .catch((err) => console.log(err))
      .finally(() => this.setState({ isAppending: false }));
  };

  getDiff = (diff: string) => {
    const selectedVersions = this.state.versions.filter((version) => version.checked);
    const [newInfo, baseInfo] = selectedVersions;
    const isNewLatest = newInfo.version === this.props.dashboard.version;

    this.setState({
      baseInfo,
      isLoading: true,
      isNewLatest,
      newInfo,
      viewMode: 'compare',
    });

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
        this.setState({
          // @ts-ignore
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
    versions.map((version) => ({
      ...version,
      createdDateString: this.props.dashboard.formatDate(version.created),
      ageString: this.props.dashboard.getRelativeTime(version.created),
      checked: false,
    }));

  isLastPage() {
    return this.state.versions.find((rev) => rev.version === 1);
  }

  onCheck = (ev: React.FormEvent<HTMLInputElement>, versionId: number) => {
    this.setState({
      versions: this.state.versions.map((version) =>
        version.id === versionId ? { ...version, checked: ev.currentTarget.checked } : version
      ),
    });
  };

  reset = () => {
    this.setState({
      baseInfo: undefined,
      delta: { basic: '', json: '' },
      isNewLatest: false,
      newInfo: undefined,
      versions: this.state.versions.map((version) => ({ ...version, checked: false })),
      viewMode: 'list',
    });
  };

  render() {
    const { versions, viewMode, baseInfo, newInfo, isNewLatest, isLoading, delta } = this.state;
    const canCompare = versions.filter((version) => version.checked).length !== 2;
    const showButtons = versions.length > 1;
    const hasMore = versions.length >= this.limit;

    if (viewMode === 'compare') {
      return (
        <div>
          <VersionHistoryHeader
            isComparing
            onClick={this.reset}
            baseVersion={baseInfo?.version}
            newVersion={newInfo?.version}
            isNewLatest={isNewLatest}
          />
          {isLoading ? (
            <VersionsHistorySpinner msg="Fetching changes&hellip;" />
          ) : (
            <VersionHistoryComparison
              dashboard={this.props.dashboard}
              newInfo={newInfo}
              baseInfo={baseInfo}
              isNewLatest={isNewLatest}
              onFetchFail={this.reset}
              delta={delta}
            />
          )}
        </div>
      );
    }

    return (
      <div>
        <VersionHistoryHeader />
        {isLoading ? (
          <VersionsHistorySpinner msg="Fetching history list&hellip;" />
        ) : (
          <VersionHistoryTable versions={versions} onCheck={this.onCheck} />
        )}
        {this.state.isAppending && <VersionsHistorySpinner msg="Fetching more entries&hellip;" />}
        {showButtons && (
          <VersionsHistoryButtons
            hasMore={hasMore}
            canCompare={canCompare}
            getVersions={this.getVersions}
            getDiff={this.getDiff}
            isLastPage={!!this.isLastPage()}
          />
        )}
      </div>
    );
  }
}

const VersionsHistorySpinner = ({ msg }: { msg: string }) => (
  <HorizontalGroup>
    <Spinner />
    <em>{msg}</em>
  </HorizontalGroup>
);
