import * as React from 'react';

import { PageLayoutType, dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, sceneGraph } from '@grafana/scenes';
import { Spinner, Stack } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';
import { RevisionsModel, historySrv } from './version-history/HistorySrv';
import { VersionsHistoryButtons } from './version-history/VersionHistoryButtons';
import { VersionHistoryComparison } from './version-history/VersionHistoryComparison';
import { VersionHistoryHeader } from './version-history/VersionHistoryHeader';
import { VersionHistoryTable } from './version-history/VersionHistoryTable';

export const VERSIONS_FETCH_LIMIT = 10;

export type DecoratedRevisionModel = RevisionsModel & {
  createdDateString: string;
  ageString: string;
};

export interface VersionsEditViewState extends DashboardEditViewState {
  versions?: DecoratedRevisionModel[];
  isLoading?: boolean;
  isAppending?: boolean;
  viewMode?: 'list' | 'compare';
  diffData?: { lhs: string; rhs: string };
  newInfo?: DecoratedRevisionModel;
  baseInfo?: DecoratedRevisionModel;
  isNewLatest?: boolean;
}

export class VersionsEditView extends SceneObjectBase<VersionsEditViewState> implements DashboardEditView {
  public static Component = VersionsEditorSettingsListView;
  private _limit: number = VERSIONS_FETCH_LIMIT;
  private _start = 0;
  private _continueToken = '';

  constructor(state: VersionsEditViewState) {
    super({
      ...state,
      versions: [],
      isLoading: true,
      isAppending: true,
      viewMode: 'list',
      isNewLatest: false,
      diffData: {
        lhs: '',
        rhs: '',
      },
    });

    this.addActivationHandler(() => {
      this.fetchVersions();
    });
  }

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public get diffData(): { lhs: string; rhs: string } {
    return this.state.diffData ?? { lhs: '', rhs: '' };
  }

  public get versions(): DecoratedRevisionModel[] {
    return this.state.versions ?? [];
  }

  public get limit(): number {
    return this._limit;
  }

  public get start(): number {
    return this._start;
  }

  public get continueToken(): string {
    return this._continueToken;
  }

  public getUrlKey(): string {
    return 'versions';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public getTimeRange() {
    return sceneGraph.getTimeRange(this._dashboard);
  }

  public fetchVersions = (append = false): void => {
    const uid = this._dashboard.state.uid;

    if (!uid) {
      return;
    }

    this.setState({ isAppending: append });

    const requestOptions = this._continueToken
      ? { limit: this._limit, start: this._start, continueToken: this._continueToken }
      : { limit: this._limit, start: this._start };

    historySrv
      .getHistoryList(uid, requestOptions)
      .then((result) => {
        this.setState({
          isLoading: false,
          versions: [...(this.state.versions ?? []), ...this.decorateVersions(result.versions)],
        });
        this._start += this._limit;
        // Update the continueToken for the next request, if available
        this._continueToken = result.continueToken ?? '';
      })
      .catch((err) => console.log(err))
      .finally(() => this.setState({ isAppending: false }));
  };

  public getDiff = async () => {
    const selectedVersions = this.versions.filter((version) => version.checked);
    const [newInfo, baseInfo] = selectedVersions;
    const isNewLatest = newInfo.version === this._dashboard.state.version;

    this.setState({
      isLoading: true,
    });

    if (!this._dashboard.state.uid) {
      return;
    }
    // the id here is the resource version in k8s, use this instead to get the specific version
    let lhs = await historySrv.getDashboardVersion(this._dashboard.state.uid, baseInfo.id);
    let rhs = await historySrv.getDashboardVersion(this._dashboard.state.uid, newInfo.id);

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

  public reset = () => {
    this._continueToken = '';
    this.setState({
      baseInfo: undefined,
      diffData: {
        lhs: '',
        rhs: '',
      },
      isNewLatest: false,
      newInfo: undefined,
      versions: this.versions.map((version) => ({ ...version, checked: false })),
      viewMode: 'list',
    });
  };

  public onCheck = (ev: React.FormEvent<HTMLInputElement>, versionId: number) => {
    this.setState({
      versions: this.versions.map((version) =>
        version.id === versionId ? { ...version, checked: ev.currentTarget.checked } : version
      ),
    });
  };

  private decorateVersions(versions: RevisionsModel[]): DecoratedRevisionModel[] {
    const timeZone = this.getTimeRange().getTimeZone();

    return versions.map((version) => {
      return {
        ...version,
        createdDateString: dateTimeFormat(version.created, { timeZone: timeZone }),
        ageString: dateTimeFormatTimeAgo(version.created, { timeZone: timeZone }),
        checked: false,
      };
    });
  }
}

function VersionsEditorSettingsListView({ model }: SceneComponentProps<VersionsEditView>) {
  const dashboard = model.getDashboard();
  const { isLoading, isAppending, viewMode, baseInfo, newInfo, isNewLatest } = model.useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const canCompare = model.versions.filter((version) => version.checked).length === 2;
  const showButtons = model.versions.length > 1;
  const hasMore = model.versions.length >= model.limit;
  // older versions may have been cleaned up in the db, so also check if the last page is less than the limit, if so, we are at the end
  let isLastPage =
    model.versions.find((rev) => rev.version === 1) ||
    model.versions.length % model.limit !== 0 ||
    model.continueToken === '';

  const viewModeCompare = (
    <>
      <VersionHistoryHeader
        onClick={model.reset}
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
          isNewLatest={isNewLatest!}
          diffData={model.diffData}
          onRestore={dashboard.onRestore}
        />
      )}
    </>
  );

  const viewModeList = (
    <>
      {isLoading ? (
        <VersionsHistorySpinner msg="Fetching history list&hellip;" />
      ) : (
        <VersionHistoryTable
          versions={model.versions}
          onCheck={model.onCheck}
          canCompare={canCompare}
          onRestore={dashboard.onRestore}
        />
      )}
      {isAppending && <VersionsHistorySpinner msg="Fetching more entries&hellip;" />}
      {showButtons && (
        <VersionsHistoryButtons
          hasMore={hasMore}
          canCompare={canCompare}
          getVersions={model.fetchVersions}
          getDiff={model.getDiff}
          isLastPage={!!isLastPage}
        />
      )}
    </>
  );

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      {viewMode === 'compare' ? viewModeCompare : viewModeList}
    </Page>
  );
}

const VersionsHistorySpinner = ({ msg }: { msg: string }) => (
  <Stack>
    <Spinner />
    <em>{msg}</em>
  </Stack>
);
