import React from 'react';

import { NavModel, NavModelItem, PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { DashboardLink } from '@grafana/schema';
import { Link } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { DashboardScene } from '../scene/DashboardScene';
import { NavToolbarActions } from '../scene/NavToolbarActions';
import { getDashboardSceneFor } from '../utils/utils';

import { EditListViewSceneUrlSync } from './EditListViewSceneUrlSync';
import { DashboardEditView, DashboardEditListViewState, useDashboardEditPageNav } from './utils';

export interface DashboardLinksEditViewState extends DashboardEditListViewState {}

export class DashboardLinksEditView extends SceneObjectBase<DashboardLinksEditViewState> implements DashboardEditView {
  static Component = DashboardLinksEditViewRenderer;

  protected _urlSync = new EditListViewSceneUrlSync(this);

  public getUrlKey(): string {
    return 'links';
  }
}

function DashboardLinksEditViewRenderer({ model }: SceneComponentProps<DashboardLinksEditView>) {
  const { editIndex } = model.useState();
  const dashboard = getDashboardSceneFor(model);
  const links = dashboard.state.links || [];
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());

  if (editIndex !== undefined) {
    const link = links[editIndex];
    if (link) {
      return <EditLinkView pageNav={pageNav} navModel={navModel} link={link} dashboard={dashboard} />;
    }
  }

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      {links.map((link, i) => (
        <Link
          key={`${link.title}-${i}`}
          onClick={(e) => {
            e.preventDefault();
            locationService.partial({ editIndex: i });
          }}
        >
          {link.title}
        </Link>
      ))}
    </Page>
  );
}

interface EditLinkViewProps {
  link: DashboardLink;
  pageNav: NavModelItem;
  navModel: NavModel;
  dashboard: DashboardScene;
}

function EditLinkView({ pageNav, link, navModel, dashboard }: EditLinkViewProps) {
  const parentTab = pageNav.children!.find((p) => p.active)!;
  parentTab.parentItem = pageNav;

  const editLinkPageNav = {
    text: 'Edit link',
    parentItem: parentTab,
  };

  return (
    <Page navModel={navModel} pageNav={editLinkPageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      {JSON.stringify(link)}
    </Page>
  );
}
