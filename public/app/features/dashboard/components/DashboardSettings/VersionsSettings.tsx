import { PureComponent } from 'react';
import * as React from 'react';

import { Spinner, HorizontalGroup } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { historySrv, RevisionsModel } from 'app/features/dashboard-scene/settings/version-history/HistorySrv';
import { VersionsHistoryButtons } from 'app/features/dashboard-scene/settings/version-history/VersionHistoryButtons';
import { VersionHistoryHeader } from 'app/features/dashboard-scene/settings/version-history/VersionHistoryHeader';

import { VersionHistoryComparison } from '../VersionHistory/VersionHistoryComparison';
import { VersionHistoryTable } from '../VersionHistory/VersionHistoryTable';

import { SettingsPageProps } from './types';

interface Props extends SettingsPageProps {}

type State = {
  isLoading: boolean;
  isAppending: boolean;
  versions: DecoratedRevisionModel[];
  viewMode: 'list' | 'compare';
  diffData: { lhs: string; rhs: string };
  newInfo?: DecoratedRevisionModel;
  baseInfo?: DecoratedRevisionModel;
  isNewLatest: boolean;
};

export type DecoratedRevisionModel = RevisionsModel & {
  createdDateString: string;
  ageString: string;
};

export const VERSIONS_FETCH_LIMIT = 10;

export class VersionsSettings extends PureComponent<Props, State> {
  limit: number;
  start: number;
  continueToken: string;

  constructor(props: Props) {
    super(props);
    this.limit = VERSIONS_FETCH_LIMIT;
    this.start = 0;
    this.continueToken = '';
    this.state = {
      isAppending: true,
      isLoading: true,
      versions: [],
      viewMode: 'list',
      isNewLatest: false,
      diffData: {
        lhs: '',
        rhs: '',
      },
    };
  }

  componentDidMount() {
    this.getVersions();
  }

  getVersions = (append = false) => {
    this.setState({ isAppending: append });
    const requestOptions = this.continueToken
      ? { limit: this.limit, start: this.start, continueToken: this.continueToken }
      : { limit: this.limit, start: this.start };

    historySrv
      .getHistoryList(this.props.dashboard.uid, requestOptions)
      .then((res) => {
        this.setState({
          isLoading: false,
          versions: [...(this.state.versions ?? []), ...this.decorateVersions(res.versions)],
        });
        this.start += this.limit;
        // Update the continueToken for the next request, if available
        this.continueToken = res.continueToken ?? '';
      })
      .catch((err) => console.log(err))
      .finally(() => this.setState({ isAppending: false }));
  };

  getDiff = async () => {
    const selectedVersions = this.state.versions.filter((version) => version.checked);
    const [newInfo, baseInfo] = selectedVersions;
    const isNewLatest = newInfo.version === this.props.dashboard.version;

    this.setState({
      isLoading: true,
    });

    // the id here is the resource version in k8s, use this instead to get the specific version
    let lhs = await historySrv.getDashboardVersion(this.props.dashboard.uid, baseInfo.id);
    let rhs = await historySrv.getDashboardVersion(this.props.dashboard.uid, newInfo.id);

    this.setState({
      baseInfo,
      isLoading: false,
      isNewLatest,
      newInfo,
      viewMode: 'compare',
      diffData: {
        lhs: lhs.data,
        rhs: rhs.data,
      },
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
    return (
      this.state.versions.find((rev) => rev.version === 1) ||
      this.state.versions.length % this.limit !== 0 ||
      this.continueToken === ''
    );
  }

  onCheck = (ev: React.FormEvent<HTMLInputElement>, versionId: number) => {
    this.setState({
      versions: this.state.versions.map((version) =>
        version.id === versionId ? { ...version, checked: ev.currentTarget.checked } : version
      ),
    });
  };

  reset = () => {
    this.continueToken = '';
    this.setState({
      baseInfo: undefined,
      diffData: {
        lhs: '',
        rhs: '',
      },
      isNewLatest: false,
      newInfo: undefined,
      versions: this.state.versions.map((version) => ({ ...version, checked: false })),
      viewMode: 'list',
    });
  };

  render() {
    const { versions, viewMode, baseInfo, newInfo, isNewLatest, isLoading, diffData } = this.state;
    const canCompare = versions.filter((version) => version.checked).length === 2;
    const showButtons = versions.length > 1;
    const hasMore = versions.length >= this.limit;
    const pageNav = this.props.sectionNav.node.parentItem;

    if (viewMode === 'compare') {
      return (
        <Page navModel={this.props.sectionNav} pageNav={pageNav}>
          <VersionHistoryHeader
            onClick={this.reset}
            baseVersion={baseInfo?.version}
            newVersion={newInfo?.version}
            isNewLatest={isNewLatest}
          />
          {isLoading ? (
            <VersionsHistorySpinner msg="Fetching changes&hellip;" />
          ) : (
            <VersionHistoryComparison
              newInfo={newInfo!}
              baseInfo={baseInfo!}
              isNewLatest={isNewLatest}
              diffData={diffData}
            />
          )}
        </Page>
      );
    }

    return (
      <Page navModel={this.props.sectionNav} pageNav={pageNav}>
        {isLoading ? (
          <VersionsHistorySpinner msg="Fetching history list&hellip;" />
        ) : (
          <VersionHistoryTable versions={versions} onCheck={this.onCheck} canCompare={canCompare} />
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
      </Page>
    );
  }
}

export const VersionsHistorySpinner = ({ msg }: { msg: string }) => (
  <HorizontalGroup>
    <Spinner />
    <em>{msg}</em>
  </HorizontalGroup>
);
