import { skipToken } from '@reduxjs/toolkit/query/react';
import * as React from 'react';
import { useMemo } from 'react';

import { PageLayoutType, dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneComponentProps, SceneObjectBase, sceneGraph } from '@grafana/scenes';
import { Alert, Spinner, Stack } from '@grafana/ui';
import { useGetDisplayMappingQuery } from 'app/api/clients/iam/v0alpha1';
import { Page } from 'app/core/components/Page/Page';
import {
  AnnoKeyCreatedBy,
  AnnoKeyMessage,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  Resource,
} from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import {
  DecoratedRevisionModel,
  RevisionModel,
  VERSIONS_FETCH_LIMIT,
} from 'app/features/dashboard/types/revisionModels';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';
import { VersionsHistoryButtons } from './version-history/VersionHistoryButtons';
import { VersionHistoryComparison } from './version-history/VersionHistoryComparison';
import { VersionHistoryHeader } from './version-history/VersionHistoryHeader';
import { VersionHistoryTable } from './version-history/VersionHistoryTable';

export interface VersionsEditViewState extends DashboardEditViewState {
  versions?: DecoratedRevisionModel[];
  isLoading?: boolean;
  viewMode?: 'list' | 'compare';
  diffData?: { lhs: object; rhs: object };
  newInfo?: DecoratedRevisionModel;
  baseInfo?: DecoratedRevisionModel;
  isNewLatest?: boolean;
}

export class VersionsEditView extends SceneObjectBase<VersionsEditViewState> implements DashboardEditView {
  public static Component = VersionsEditorSettingsListView;
  private _limit: number = VERSIONS_FETCH_LIMIT;

  constructor(state: VersionsEditViewState) {
    super({
      ...state,
      versions: [],
      isLoading: true,
      viewMode: 'list',
      isNewLatest: false,
      diffData: { lhs: {}, rhs: {} },
    });

    this.addActivationHandler(() => {
      this.fetchVersions();
    });
  }

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public get diffData(): { lhs: object; rhs: object } {
    return this.state.diffData ?? { lhs: {}, rhs: {} };
  }

  public get versions(): DecoratedRevisionModel[] {
    return this.state.versions ?? [];
  }

  public get limit(): number {
    return this._limit;
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

  public fetchVersions = (): void => {
    const uid = this._dashboard.state.uid;

    if (!uid) {
      return;
    }

    getDashboardAPI()
      .then(async (api) => {
        const result = await api.listDashboardHistory(uid, { limit: this._limit });
        const versions = this.transformToRevisionModels(result.items);
        versions.sort((a, b) => b.version - a.version);
        this.setState({
          isLoading: false,
          versions: this.decorateVersions(versions),
        });
      })
      .catch((err) => console.log(err));
  };

  private transformToRevisionModels(items: Array<Resource<unknown>>): RevisionModel[] {
    return items.map(
      (item): RevisionModel => ({
        id: item.metadata.generation ?? 0,
        checked: false,
        uid: item.metadata.name,
        version: item.metadata.generation ?? 0,
        created:
          item.metadata.annotations?.[AnnoKeyUpdatedTimestamp] ??
          item.metadata.creationTimestamp ??
          new Date().toISOString(),
        createdBy: item.metadata.annotations?.[AnnoKeyUpdatedBy] ?? item.metadata.annotations?.[AnnoKeyCreatedBy] ?? '',
        message: item.metadata.annotations?.[AnnoKeyMessage] ?? '',
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        data: item.spec as object,
      })
    );
  }

  public getDiff = () => {
    const selectedVersions = this.versions.filter((version) => version.checked);
    const [newInfo, baseInfo] = selectedVersions;
    const isNewLatest = newInfo.version === this._dashboard.state.version;

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

  public reset = () => {
    this.setState({
      baseInfo: undefined,
      diffData: { lhs: {}, rhs: {} },
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

  private decorateVersions(versions: RevisionModel[]): DecoratedRevisionModel[] {
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
  const { isLoading, viewMode, baseInfo, newInfo, isNewLatest } = model.useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

  const userKeys = useMemo(
    () => [...new Set(model.versions.map((v) => v.createdBy).filter(Boolean))],
    [model.versions]
  );
  const { data: displayData } = useGetDisplayMappingQuery(userKeys.length > 0 ? { key: userKeys } : skipToken);
  const isLoadingUserDisplayNames = userKeys.length > 0 && !displayData;

  const versionsWithDisplayNames = useMemo(() => {
    if (!displayData) {
      return model.versions;
    }
    const displayMap = new Map<string, string>();
    for (const item of displayData.display) {
      displayMap.set(`${item.identity.type}:${item.identity.name}`, item.displayName);
      if (item.internalId) {
        displayMap.set(String(item.internalId), item.displayName);
      }
    }
    return model.versions.map((version) => {
      const displayName = version.createdBy ? displayMap.get(version.createdBy) : undefined;
      return displayName ? { ...version, createdBy: displayName } : version;
    });
  }, [model.versions, displayData]);

  const canCompare = model.versions.filter((version) => version.checked).length === 2;
  const showButtons = model.versions.length > 1;

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
          versions={versionsWithDisplayNames}
          onCheck={model.onCheck}
          canCompare={canCompare}
          onRestore={dashboard.onRestore}
          isLoadingUserDisplayNames={isLoadingUserDisplayNames}
        />
      )}
      {showButtons && (
        <VersionsHistoryButtons
          canCompare={canCompare}
          getDiff={model.getDiff}
        />
      )}
    </>
  );

  const isProvisioned = dashboard.isManagedRepository();

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      {isProvisioned ? (
        <Alert title="" severity="info">
          <Trans i18nKey="dashboard-settings.versions.provisioned-warning">
            This dashboard is managed by a repository. Version history is not available for provisioned dashboards.
          </Trans>
        </Alert>
      ) : viewMode === 'compare' ? (
        viewModeCompare
      ) : (
        viewModeList
      )}
    </Page>
  );
}

const VersionsHistorySpinner = ({ msg }: { msg: string }) => (
  <Stack>
    <Spinner />
    <em>{msg}</em>
  </Stack>
);
