import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  SceneGridItem,
  SceneGridRow,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { Icon, TextLink, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { RowOptionsButton } from 'app/features/dashboard/components/RowOptions/RowOptionsButton';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { ShowConfirmModalEvent } from 'app/types/events';

import { getDashboardSceneFor } from '../utils/utils';

import { DashboardScene } from './DashboardScene';

export interface RowActionsState extends SceneObjectState {}

export class RowActions extends SceneObjectBase<RowActionsState> {
  public constructor(state: RowActionsState) {
    super({
      ...state,
    });
  }

  private get _dashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public getParent(): SceneGridRow {
    if (!(this.parent instanceof SceneGridRow)) {
      throw new Error('RowActions must have a SceneGridRow parent');
    }

    return this.parent;
  }

  public getDashboard(): DashboardScene {
    return this._dashboard;
  }

  public onUpdate = () => {
    console.log('onUpdate');
  };

  public onDelete = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete row',
        text: 'Are you sure you want to remove this row and all its panels?',
        altActionText: 'Delete row only',
        icon: 'trash-alt',
        onConfirm: () => {
          this._dashboard.removeRow(this.getParent(), true);
        },
        onAltAction: () => {
          this._dashboard.removeRow(this.getParent(), false);
        },
      })
    );
  };

  public getWarning = () => {
    const row = this.getParent();
    const gridItems = row.state.children;

    const isAnyPanelUsingDashboardDS = gridItems.some((gridItem) => {
      if (!(gridItem instanceof SceneGridItem)) {
        return false;
      }

      //todo does it apply to libraryVizPanels as well??
      if (gridItem.state.body instanceof VizPanel && gridItem.state.body.state.$data instanceof SceneQueryRunner) {
        return gridItem.state.body.state.$data?.state.datasource?.uid === SHARED_DASHBOARD_QUERY;
      }

      return false;
    });

    if (isAnyPanelUsingDashboardDS) {
      return (
        <div>
          <p>
            Panels in this row use the {SHARED_DASHBOARD_QUERY} data source. These panels will reference the panel in
            the original row, not the ones in the repeated rows.
          </p>
          <TextLink
            external
            href={
              'https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/create-dashboard/#configure-repeating-rows'
            }
          >
            Learn more
          </TextLink>
        </div>
      );
    }

    return undefined;
  };

  static Component = ({ model }: SceneComponentProps<RowActions>) => {
    const dashboard = model.getDashboard();
    const row = model.getParent();
    const { meta, isEditing } = dashboard.useState();
    const styles = useStyles2(getStyles);

    const { isCollapsed } = row.useState();
    const count = row.state.children ? row.state.children.length : 0;
    const panels = count === 1 ? 'panel' : 'panels';

    return (
      <>
        {meta.canEdit && isEditing && (
          <>
            <span className={cx(styles.panelCount, isCollapsed && styles.panelCountCollapsed)}>
              ({count} {panels})
            </span>
            <div className={styles.rowActions}>
              <RowOptionsButton
                title={row.state.title}
                //TODO add repeat prop to SceneGridRow?
                repeat={undefined}
                onUpdate={model.onUpdate}
                warning={model.getWarning()}
              />
              <button type="button" onClick={model.onDelete} aria-label="Delete row">
                <Icon name="trash-alt" />
              </button>
            </div>
          </>
        )}
      </>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    rowActions: css({
      color: theme.colors.text.secondary,
      opacity: 0,
      transition: '200ms opacity ease-in 200ms',

      button: {
        color: theme.colors.text.secondary,
        paddingLeft: theme.spacing(1),
        background: 'transparent',
        border: 'none',
        height: '100%',

        '&:hover': {
          color: theme.colors.text.maxContrast,
        },
      },

      '&:hover, &:focus-within': {
        opacity: 1,
      },
    }),
    panelCount: css({
      paddingLeft: theme.spacing(1),
      color: theme.colors.text.secondary,
      fontStyle: 'italic',
      fontSize: theme.typography.size.sm,
      fontWeight: 'normal',
      display: 'none',
    }),
    panelCountCollapsed: css({
      display: 'inline-block',
    }),
  };
};
