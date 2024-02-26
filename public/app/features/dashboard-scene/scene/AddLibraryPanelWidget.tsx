import { css, cx, keyframes } from '@emotion/css';
import React from 'react';
import tinycolor from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  SceneGridItem,
  SceneGridLayout,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { LibraryPanel } from '@grafana/schema';
import { IconButton, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import {
  LibraryPanelsSearch,
  LibraryPanelsSearchVariant,
} from 'app/features/library-panels/components/LibraryPanelsSearch/LibraryPanelsSearch';

import { getDashboardSceneFor } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { LibraryVizPanel } from './LibraryVizPanel';

export interface AddLibraryPanelWidgetState extends SceneObjectState {
  key: string;
}

export class AddLibraryPanelWidget extends SceneObjectBase<AddLibraryPanelWidgetState> {
  public constructor(state: AddLibraryPanelWidgetState) {
    super({
      ...state,
    });
  }

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public onCancelAddPanel = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.preventDefault();

    if (!(this._dashboard.state.body instanceof SceneGridLayout)) {
      throw new Error('Trying to remove the library panel widget in a layout that is not SceneGridLayout');
    }

    const sceneGridLayout = this._dashboard.state.body;

    sceneGridLayout.setState({
      children: sceneGridLayout.state.children.filter(
        (child) => !(child instanceof SceneGridItem && child.state.body?.state.key === this.state.key)
      ),
    });
  };

  public onAddLibraryPanel = (panelInfo: LibraryPanel) => {
    if (!(this._dashboard.state.body instanceof SceneGridLayout)) {
      throw new Error('Trying to add a library panel in a layout that is not SceneGridLayout');
    }

    const sceneGridLayout = this._dashboard.state.body;

    const body = new LibraryVizPanel({
      title: 'Panel Title',
      uid: panelInfo.uid,
      name: panelInfo.name,
      key: this.state.key,
    });

    const widgetChild = sceneGridLayout.state.children.find(
      (child) =>
        child instanceof SceneGridItem &&
        child.state.body instanceof AddLibraryPanelWidget &&
        child.state.body.state.key === this.state.key
    );

    if (widgetChild instanceof SceneGridItem) {
      widgetChild.setState({ body });
    }
  };

  static Component = ({ model }: SceneComponentProps<AddLibraryPanelWidget>) => {
    const dashboard = model.getDashboard();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.wrapper}>
        <div className={cx('panel-container', styles.callToAction)}>
          <div className={cx(styles.headerRow, `grid-drag-handle-${dashboard.state.body.state.key}`)}>
            <span>
              <Trans i18nKey="library-panel.add-widget.title">Add panel from panel library</Trans>
            </span>
            <div className="flex-grow-1" />
            <IconButton
              aria-label="Close 'Add Panel' widget"
              name="times"
              onClick={model.onCancelAddPanel}
              tooltip="Close widget"
            />
          </div>
          <LibraryPanelsSearch
            onClick={model.onAddLibraryPanel}
            variant={LibraryPanelsSearchVariant.Tight}
            showPanelFilter
          />
        </div>
      </div>
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
