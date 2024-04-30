import React from 'react';

import {
  SceneComponentProps,
  SceneGridLayout,
  SceneGridRow,
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
  gridItemToReplaceRef?: SceneObjectRef<DashboardGridItem>;
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

    const gridItemToReplace = this.state.gridItemToReplaceRef?.resolve();

    if (gridItemToReplace) {
      const newGridItem = gridItemToReplace.clone({ body });
      const key = gridItemToReplace?.state.key;

      if (gridItemToReplace.parent instanceof SceneGridRow) {
        const rowChildren = gridItemToReplace.parent.state.children.map((rowChild) => {
          if (rowChild.state.key === key) {
            return newGridItem;
          }
          return rowChild;
        });
        gridItemToReplace.parent.setState({ children: rowChildren });
        layout.forceRender();
      } else {
        // Find the grid item in the layout and replace it
        const children = layout.state.children.map((child) => {
          if (child.state.key === key) {
            return newGridItem;
          }
          return child;
        });

        layout.setState({ children });
      }
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
