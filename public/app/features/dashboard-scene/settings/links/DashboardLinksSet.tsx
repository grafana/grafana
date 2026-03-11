import { useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { SceneObject, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import type { DashboardLink } from '@grafana/schema';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { DashboardScene } from '../../scene/DashboardScene';
import { EditableDashboardElement, EditableDashboardElementInfo } from '../../scene/types/EditableDashboardElement';

import { LinkEdit, linkSelectionId } from './LinkAddEditableElement';
import { LinkList } from './LinkList';

export interface DashboardLinksSetState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

function useEditPaneOptions(
  this: DashboardLinksSet,
  dashboardRef: SceneObjectRef<DashboardScene>
): OptionsPaneCategoryDescriptor[] {
  const linkListId = useId();
  const dashboard = dashboardRef.resolve();

  const options = useMemo(() => {
    return new OptionsPaneCategoryDescriptor({ title: '', id: 'links' }).addItem(
      new OptionsPaneItemDescriptor({
        title: '',
        id: linkListId,
        skipField: true,
        render: () => <LinkList dashboard={dashboard} />,
      })
    );
  }, [linkListId, dashboard]);

  return [options];
}

export class DashboardLinksSet extends SceneObjectBase<DashboardLinksSetState> implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  private _cachedLinks: DashboardLink[] | undefined;
  private _linkEditItems: LinkEdit[] = [];

  public constructor(state: DashboardLinksSetState) {
    super({ ...state, key: 'dashboard-links-set' });
  }

  public getEditableElementInfo(): EditableDashboardElementInfo {
    const dashboard = this.state.dashboardRef.resolve();
    const links = dashboard.state.links ?? [];
    return {
      typeName: t('dashboard.edit-pane.elements.link-set', 'Links'),
      icon: 'link',
      instanceName: t('dashboard.edit-pane.elements.link-set', 'Links'),
      isHidden: links.length === 0,
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

  public useEditPaneOptions = useEditPaneOptions.bind(this, this.state.dashboardRef);
}
