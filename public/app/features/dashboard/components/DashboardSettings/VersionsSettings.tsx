import { PureComponent } from 'react';
import * as React from 'react';

import { Spinner, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { Resource } from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import {
  DecoratedRevisionModel,
  RevisionModel,
  VERSIONS_FETCH_LIMIT,
} from 'app/features/dashboard/types/revisionModels';
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
  diffData: { lhs: object; rhs: object };
  newInfo?: DecoratedRevisionModel;
  baseInfo?: DecoratedRevisionModel;
  isNewLatest: boolean;
};

export class VersionsSettings extends PureComponent<Props, State> {
  continueToken: string;

  constructor(props: Props) {
    super(props);
    this.continueToken = '';
    this.state = {
      isAppending: true,
      isLoading: true,
      versions: [],
      viewMode: 'list',
      isNewLatest: false,
      diffData: { lhs: {}, rhs: {} },
    };
  }

  componentDidMount() {
    this.getVersions();
  }

  getVersions = (append = false) => {
    this.setState({ isAppending: append });

    const options = append
      ? { limit: VERSIONS_FETCH_LIMIT, continueToken: this.continueToken }
      : { limit: VERSIONS_FETCH_LIMIT };

    getDashboardAPI()
      .listDashboardHistory(this.props.dashboard.uid, options)
      .then((result) => {
        const versions = this.transformToRevisionModels(result.items);
        this.setState({
          isLoading: false,
          versions: [...(this.state.versions ?? []), ...this.decorateVersions(versions)],
        });
        // Update the continueToken for the next request, if available
        this.continueToken = result.metadata.continue ?? '';
      })
      .catch((err) => console.log(err))
      .finally(() => this.setState({ isAppending: false }));
  };

  transformToRevisionModels(items: Array<Resource<unknown>>): RevisionModel[] {
    return items.map(
      (item): RevisionModel => ({
        id: item.metadata.generation ?? 0,
        checked: false,
        uid: item.metadata.name,
        version: item.metadata.generation ?? 0,
        created: item.metadata.creationTimestamp ?? new Date().toISOString(),
        createdBy: item.metadata.annotations?.['grafana.app/updatedBy'] ?? '',
        message: item.metadata.annotations?.['grafana.app/message'] ?? '',
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        data: item.spec as object,
      })
    );
  }

  getDiff = () => {
    const selectedVersions = this.state.versions.filter((version) => version.checked);
    const [newInfo, baseInfo] = selectedVersions;
    const isNewLatest = newInfo.version === this.props.dashboard.version;

    // Use the already-loaded data from listDashboardHistory - no need for another API call
    this.setState({
      baseInfo,
      isLoading: false,
      isNewLatest,
      newInfo,
      viewMode: 'compare',
      diffData: { lhs: baseInfo.data, rhs: newInfo.data },
    });
  };

  decorateVersions = (versions: RevisionModel[]) =>
    versions.map((version) => ({
      ...version,
      createdDateString: this.props.dashboard.formatDate(version.created),
      ageString: this.props.dashboard.getRelativeTime(version.created),
      checked: false,
    }));

  isLastPage() {
    return (
      this.state.versions.find((rev) => rev.version === 1) ||
      this.state.versions.length % VERSIONS_FETCH_LIMIT !== 0 ||
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
      diffData: { lhs: {}, rhs: {} },
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
    const hasMore = versions.length >= VERSIONS_FETCH_LIMIT;
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
  <Stack>
    <Spinner />
    <em>{msg}</em>
  </Stack>
);
