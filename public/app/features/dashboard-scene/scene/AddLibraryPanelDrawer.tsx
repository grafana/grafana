import { css, keyframes } from '@emotion/css';
import React from 'react';
import tinycolor from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneGridLayout, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema';
import { Drawer, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import {
  LibraryPanelsSearch,
  LibraryPanelsSearchVariant,
} from 'app/features/library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';

import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { NEW_PANEL_HEIGHT, NEW_PANEL_WIDTH, getDashboardSceneFor, getVizPanelKeyForPanelId } from '../utils/utils';

import { DashboardGridItem } from './DashboardGridItem';
import { LibraryVizPanel } from './LibraryVizPanel';

export interface AddLibraryPanelWidgetState extends SceneObjectState {}

export class AddLibraryPanelWidget extends SceneObjectBase<AddLibraryPanelWidgetState> {
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

    const newGridItem = new DashboardGridItem({
      height: NEW_PANEL_HEIGHT,
      width: NEW_PANEL_WIDTH,
      x: 0,
      y: 0,
      body: body,
      key: `grid-item-${panelId}`,
    });

    layout.setState({ children: [newGridItem, ...layout.state.children] });

    this.onClose();
  };

  static Component = ({ model }: SceneComponentProps<AddLibraryPanelWidget>) => {
    const styles = useStyles2(getStyles);
    const title = t('library-panel.add-widget.title', 'Add panel from panel library');

    return (
      <Drawer title={title} onClose={model.onClose}>
        <div className={styles.wrapper}>
          <LibraryPanelsSearch
            onClick={model.onAddLibraryPanel}
            variant={LibraryPanelsSearchVariant.Tight}
            showPanelFilter
          />
        </div>
      </Drawer>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => {
  const pulsate = keyframes({
    '0%': {
      boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main}`,
    },
    '50%': {
      boxShadow: `0 0 0 2px ${theme.components.dashboard.background}, 0 0 0px 4px ${tinycolor(theme.colors.primary.main)
        .darken(20)
        .toHexString()}`,
    },
    '100%': {
      boxShadow: `0 0 0 2px ${theme.components.dashboard.background}, 0 0 0px 4px  ${theme.colors.primary.main}`,
    },
  });

  return {
    // wrapper is used to make sure box-shadow animation isn't cut off in dashboard page
    wrapper: css({
      height: '100%',
      paddingTop: `${theme.spacing(0.5)}`,
    }),
    headerRow: css({
      display: 'flex',
      alignItems: 'center',
      height: '38px',
      flexShrink: 0,
      width: '100%',
      fontSize: theme.typography.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      paddingLeft: `${theme.spacing(1)}`,
      transition: 'background-color 0.1s ease-in-out',
      cursor: 'move',

      '&:hover': {
        background: `${theme.colors.background.secondary}`,
      },
    }),
    callToAction: css({
      overflow: 'hidden',
      outline: '2px dotted transparent',
      outlineOffset: '2px',
      boxShadow: '0 0 0 2px black, 0 0 0px 4px #1f60c4',
      animation: `${pulsate} 2s ease infinite`,
    }),
  };
};
