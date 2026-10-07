import * as React from 'react';
import { lazy, Suspense } from 'react';

import { dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { type SceneComponentProps, SceneObjectBase, sceneGraph } from '@grafana/scenes';
import { Spinner } from '@grafana/ui';
import {
  AnnoKeyCreatedBy,
  AnnoKeyMessage,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  type Resource,
  type ResourceList,
} from 'app/features/apiserver/types';
import { getDashboardAPI } from 'app/features/dashboard/api/dashboard_api';
import {
  type DecoratedRevisionModel,
  type RevisionModel,
  VERSIONS_FETCH_LIMIT,
} from 'app/features/dashboard/types/revisionModels';

import { type DashboardScene } from '../scene/DashboardScene';
import { getDashboardSceneFor } from '../utils/utils';

import { getDashboardTemplateExtension } from './enterprise-components/DashboardTemplateExtension';
import { type DashboardEditView, type DashboardEditViewState } from './utils';

const VersionsEditViewRenderer = lazy(() =>
  import('./SettingsRenderers').then((m) => ({ default: m.VersionsEditViewRenderer }))
);

function LazyVersionsEditViewRenderer(props: SceneComponentProps<VersionsEditView>) {
  return (
    <Suspense fallback={<Spinner />}>
      <VersionsEditViewRenderer {...props} />
    </Suspense>
  );
}

export interface VersionsEditViewState extends DashboardEditViewState {
  versions?: DecoratedRevisionModel[];
  isLoading?: boolean;
  isAppending?: boolean;
  viewMode?: 'list' | 'compare';
  diffData?: { lhs: object; rhs: object };
  newInfo?: DecoratedRevisionModel;
  baseInfo?: DecoratedRevisionModel;
  isNewLatest?: boolean;
}

export class VersionsEditView extends SceneObjectBase<VersionsEditViewState> implements DashboardEditView {
  public static Component = LazyVersionsEditViewRenderer;
  private _limit: number = VERSIONS_FETCH_LIMIT;
  private _continueToken = '';

  constructor(state: VersionsEditViewState) {
    super({
      ...state,
      versions: [],
      isLoading: true,
      isAppending: true,
      viewMode: 'list',
      isNewLatest: false,
      diffData: { lhs: {}, rhs: {} },
    });

    this.addActivationHandler(() => {
      if (this._dashboard.isManagedRepository()) {
        // The view only renders an unavailable alert for repo-managed dashboards.
        this.setState({ isLoading: false, isAppending: false });
        return;
      }
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
    const { uid, meta } = this._dashboard.state;
    const isDashboardTemplate = Boolean(meta.isDashboardTemplate);
    const dashboardTemplateUid = meta.dashboardTemplateUid;

    if (!uid && !(isDashboardTemplate && dashboardTemplateUid)) {
      return;
    }

    this.setState({ isAppending: append });

    const options = append ? { limit: this._limit, continueToken: this._continueToken } : { limit: this._limit };

    let loader: Promise<ResourceList<unknown>>;
    if (isDashboardTemplate && dashboardTemplateUid) {
      loader = getDashboardTemplateExtension().listHistory(dashboardTemplateUid, options);
    } else {
      loader = getDashboardAPI().then((api) => api.listDashboardHistory(uid!, options));
    }

    loader
      .then((result) => {
        const versions = this.transformToRevisionModels(result.items, isDashboardTemplate);
        this.setState({
          isLoading: false,
          versions: [...(append ? (this.state.versions ?? []) : []), ...this.decorateVersions(versions)],
        });
        // Update the continueToken for the next request, if available
        this._continueToken = result.metadata.continue ?? '';
      })
      .catch((err) => console.log(err))
      .finally(() => this.setState({ isAppending: false }));
  };

  private transformToRevisionModels(items: Array<Resource<unknown>>, isDashboardTemplate = false): RevisionModel[] {
    return items.map((item): RevisionModel => {
      // For org templates the revision `data` should be the embedded dashboard spec so the
      // Compare view diffs two embedded dashboards rather than two whole template specs —
      // which matches what actually gets mutated on save/restore in this flow.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const spec = item.spec as { dashboard?: object } & object;
      const data = isDashboardTemplate ? (spec.dashboard ?? {}) : spec;

      return {
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
        data,
      };
    });
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
    this._continueToken = '';
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
