import { lazy, Suspense } from 'react';

import { arrayUtils } from '@grafana/data';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { type DashboardLink } from '@grafana/schema';
import { Spinner } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';
import { NEW_LINK, isLinkEditable } from '../settings/links/utils';
import { getDashboardSceneFor } from '../utils/utils';

import { EditListViewSceneUrlSync } from './EditListViewSceneUrlSync';
import { type DashboardEditView, type DashboardEditListViewState } from './utils';

const DashboardLinksEditViewRenderer = lazy(() =>
  import('./SettingsRenderers').then((m) => ({ default: m.DashboardLinksEditViewRenderer }))
);

function LazyDashboardLinksEditViewRenderer(props: SceneComponentProps<DashboardLinksEditView>) {
  return (
    <Suspense fallback={<Spinner />}>
      <DashboardLinksEditViewRenderer {...props} />
    </Suspense>
  );
}

export interface DashboardLinksEditViewState extends DashboardEditListViewState {}

export class DashboardLinksEditView extends SceneObjectBase<DashboardLinksEditViewState> implements DashboardEditView {
  static Component = LazyDashboardLinksEditViewRenderer;

  protected _urlSync = new EditListViewSceneUrlSync(this);

  public getUrlKey(): string {
    return 'links';
  }

  private get dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  private get links(): DashboardLink[] {
    return this.dashboard.state.links;
  }

  private set links(links: DashboardLink[]) {
    this.dashboard.setState({ links });
  }

  public onNewLink = () => {
    this.links = [...this.links, NEW_LINK];
    this.setState({ editIndex: this.links.length - 1 });
  };

  public onDelete = (editableIndex: number) => {
    const index = this.convertEditableIndexToIndex(editableIndex);
    if (index === -1) {
      return;
    }
    this.links = [...this.links.slice(0, index), ...this.links.slice(index + 1)];
    this.setState({ editIndex: undefined });
  };

  public onDuplicate = (link: DashboardLink) => {
    this.links = [...this.links, { ...link }];
  };

  public onOrderChange = (editableIndex: number, direction: number) => {
    const index = this.convertEditableIndexToIndex(editableIndex);
    const targetIndex = this.convertEditableIndexToIndex(editableIndex + direction);
    if (index === -1 || targetIndex === -1) {
      return;
    }
    this.links = arrayUtils.moveItemImmutably(this.links, index, targetIndex);
  };

  public onEdit = (editIndex: number) => {
    this.setState({ editIndex });
  };

  public onUpdateLink = (link: DashboardLink) => {
    const editableIndex = this.state.editIndex;
    if (editableIndex === undefined) {
      return;
    }
    const index = this.convertEditableIndexToIndex(editableIndex);
    if (index === -1) {
      return;
    }
    this.links = [...this.links.slice(0, index), link, ...this.links.slice(index + 1)];
  };

  private convertEditableIndexToIndex(editableIndex: number): number {
    const links = this.links;
    let count = 0;
    for (let i = 0; i < links.length; i++) {
      if (isLinkEditable(links[i])) {
        if (count === editableIndex) {
          return i;
        }
        count++;
      }
    }
    return -1;
  }

  public onGoBack = () => {
    this.setState({ editIndex: undefined });
  };
}
