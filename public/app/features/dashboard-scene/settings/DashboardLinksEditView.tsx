import React from 'react';

import { PageLayoutType } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Link } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { NavToolbarActions } from '../scene/NavToolbarActions';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';

import { EditListViewSceneUrlSync } from './EditListViewSceneUrlSync';
import { DashboardEditView, DashboardEditListViewState, useDashboardEditPageNav } from './utils';

export interface DashboardLinksEditViewState extends DashboardEditListViewState {}

export class DashboardLinksEditView extends SceneObjectBase<DashboardLinksEditViewState> implements DashboardEditView {
  static Component = DashboardLinksEditViewRenderer;

  protected _urlSync = new EditListViewSceneUrlSync(this);

  public getUrlKey(): string {
    return 'links';
  }

  getDashboardLinks() {
    const dashboard = this.state.dashboardRef.resolve();
    return dashboardSceneGraph.getDashboardLinks(dashboard);
  }
}

function DashboardLinksEditViewRenderer({ model }: SceneComponentProps<DashboardLinksEditView>) {
  const { dashboardRef, editIndex } = model.useState();
  const dashboard = dashboardRef.resolve();
  const { navModel, pageNav } = useDashboardEditPageNav(dashboard, model.getUrlKey());
  const links = dashboardSceneGraph.getDashboardLinks(dashboard);

  if (editIndex !== undefined) {
    return (
      <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
        <NavToolbarActions dashboard={dashboard} />
        <h1>Editing {JSON.stringify(links?.state.links[editIndex])}</h1>
      </Page>
    );
  }

  return (
    <Page navModel={navModel} pageNav={pageNav} layout={PageLayoutType.Standard}>
      <NavToolbarActions dashboard={dashboard} />
      {links &&
        links.state.links.map((link, i) => (
          <Link
            key={link.title}
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
