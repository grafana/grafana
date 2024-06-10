import React from 'react';

import {
  SceneComponentProps,
  SceneGridLayout,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
} from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema';
import { Drawer } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import {
  LibraryPanelsSearch,
  LibraryPanelsSearchVariant,
} from 'app/features/library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';

import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { NEW_PANEL_HEIGHT, NEW_PANEL_WIDTH, getDashboardSceneFor, getVizPanelKeyForPanelId } from '../utils/utils';

import { DashboardGridItem } from './DashboardGridItem';
import { LibraryVizPanel } from './LibraryVizPanel';

export interface AddLibraryPanelDrawerState extends SceneObjectState {
  panelToReplaceRef?: SceneObjectRef<LibraryVizPanel>;
}

export class AddLibraryPanelDrawer extends SceneObjectBase<AddLibraryPanelDrawerState> {
  public onClose = () => {
    getDashboardSceneFor(this).closeModal();
  };

  public onAddLibraryPanel = (panelInfo: LibraryPanel) => {
    const dashboard = getDashboardSceneFor(this);
    const layout = dashboard.state.body;

    if (!(layout instanceof SceneGridLayout)) {
      throw new Error('Trying to add a library panel in a layout that is not SceneGridLayout');
    }

    const panelId = dashboardSceneGraph.getNextPanelId(dashboard);

    const body = new LibraryVizPanel({
      title: 'Panel Title',
      uid: panelInfo.uid,
      name: panelInfo.name,
      panelKey: getVizPanelKeyForPanelId(panelId),
    });

    const panelToReplace = this.state.panelToReplaceRef?.resolve();

    if (panelToReplace) {
      const gridItemToReplace = panelToReplace.parent;

      if (!(gridItemToReplace instanceof DashboardGridItem)) {
        throw new Error('Trying to replace a panel that does not have a DashboardGridItem');
      }

      gridItemToReplace.setState({ body });
    } else {
      const newGridItem = new DashboardGridItem({
        height: NEW_PANEL_HEIGHT,
        width: NEW_PANEL_WIDTH,
        x: 0,
        y: 0,
        body: body,
        key: `grid-item-${panelId}`,
      });

      layout.setState({ children: [newGridItem, ...layout.state.children] });
    }

    this.onClose();
  };

  static Component = ({ model }: SceneComponentProps<AddLibraryPanelDrawer>) => {
    const title = t('library-panel.add-widget.title', 'Add panel from panel library');

    return (
      <Drawer title={title} onClose={model.onClose}>
        <LibraryPanelsSearch
          onClick={model.onAddLibraryPanel}
          variant={LibraryPanelsSearchVariant.Tight}
          showPanelFilter
        />
      </Drawer>
    );
  };
}
