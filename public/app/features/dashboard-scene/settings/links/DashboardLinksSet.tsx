import { t } from '@grafana/i18n';
import { type SceneObject, SceneObjectBase, type SceneObjectRef, type SceneObjectState } from '@grafana/scenes';
import type { DashboardLink } from '@grafana/schema';

import { type DashboardScene } from '../../scene/DashboardScene';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';

import { LinkEdit, linkSelectionId } from './LinkAddEditableElement';

export interface DashboardLinksSetState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class DashboardLinksSet extends SceneObjectBase<DashboardLinksSetState> implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  private _cachedLinks: DashboardLink[] | undefined;
  private _linkEditItems: LinkEdit[] = [];

  public constructor(state: DashboardLinksSetState) {
    super({ ...state, key: 'dashboard-links-set' });
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.sidebar.elements.link-set', 'Links'),
      icon: 'link',
      instanceName: t('dashboard.sidebar.elements.link-set', 'Links'),
    };
  }

  public getOutlineChildren(): SceneObject[] {
    const dashboard = this.state.dashboardRef.resolve();
    const links = dashboard.state.links ?? [];

    if (links !== this._cachedLinks) {
      this._cachedLinks = links;
      this._linkEditItems = links.map((_, index) => {
        const key = linkSelectionId(index);
        return new LinkEdit({ dashboardRef: this.state.dashboardRef, linkIndex: index, key });
      });
    }

    return this._linkEditItems;
  }
}
