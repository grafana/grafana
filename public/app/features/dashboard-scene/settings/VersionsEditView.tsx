import React from 'react';

import { PageLayoutType, dateTimeFormat, dateTimeFormatTimeAgo } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, sceneGraph } from '@grafana/scenes';
import { HorizontalGroup, Spinner } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { getDashboardSceneFor } from '../utils/utils';

import { DashboardEditView, DashboardEditViewState, useDashboardEditPageNav } from './utils';
import { RevisionsModel, VersionHistoryTable, historySrv } from './version-history';

export const VERSIONS_FETCH_LIMIT = 10;

export type DecoratedRevisionModel = RevisionsModel & {
  createdDateString: string;
  ageString: string;
};

export interface VersionsEditViewState extends DashboardEditViewState {
  versions?: DecoratedRevisionModel[];
  isLoading?: boolean;
  isAppending?: boolean;
}

export class VersionsEditView extends SceneObjectBase<VersionsEditViewState> implements DashboardEditView {
  public static Component = VersionsEditorSettingsListView;
  private _limit: number = VERSIONS_FETCH_LIMIT;
  private _start = 0;

  constructor(state: VersionsEditViewState) {
    super({
      ...state,
      versions: [],
      isLoading: true,
      isAppending: true,
    });

    this.addActivationHandler(() => {
      this.fetchVersions();
    });
  }

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
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

  public getUrlKey(): string {
    return 'versions';
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public getTimeRange() {
    return sceneGraph.getTimeRange(this._dashboard);
  }

  public fetchVersions(append = false): void {
    const uid = this._dashboard.state.uid;

    if (!uid) {
      return;
    }

    this.setState({ isAppending: append });

    historySrv
      .getHistoryList(uid, { limit: this._limit, start: this._start })
      .then((result) => {
        this.setState({
          isLoading: false,
          versions: [...(this.state.versions ?? []), ...this.decorateVersions(result)],
        });
        this._start += this._limit;
      })
      .catch((err) => console.log(err))
      .finally(() => this.setState({ isAppending: false }));
  }

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
  const { isLoading, isAppending } = model.useState();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

  const canCompare = model.versions.filter((version) => version.checked).length === 2;

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      {isLoading ? (
        <VersionsHistorySpinner msg="Fetching history list&hellip;" />
      ) : (
        <VersionHistoryTable
          versions={model.versions}
          onCheck={(x, y) => {
            console.log('todo');
          }}
          canCompare={canCompare}
        />
      )}
      {isAppending && <VersionsHistorySpinner msg="Fetching more entries&hellip;" />}
    </Page>
  );
}

export const VersionsHistorySpinner = ({ msg }: { msg: string }) => (
  <HorizontalGroup>
    <Spinner />
    <em>{msg}</em>
  </HorizontalGroup>
);
