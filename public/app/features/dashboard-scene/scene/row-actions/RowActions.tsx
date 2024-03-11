import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  SceneGridItem,
  SceneGridLayout,
  SceneGridRow,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { Icon, TextLink, useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { ShowConfirmModalEvent } from 'app/types/events';

import { getDashboardSceneFor } from '../../utils/utils';
import { DashboardScene } from '../DashboardScene';
import { RowRepeaterBehavior } from '../RowRepeaterBehavior';

import { RowOptionsButton } from './RowOptionsButton';

export interface RowActionsState extends SceneObjectState {}

export class RowActions extends SceneObjectBase<RowActionsState> {
  private updateLayout(rowClone: SceneGridRow): void {
    const row = this.getParent();

    const layout = this.getDashboard().state.body;

    if (!(layout instanceof SceneGridLayout)) {
      throw new Error('Layout is not a SceneGridLayout');
    }

    // remove the repeated rows
    const children = layout.state.children.filter((child) => !child.state.key?.startsWith(`${row.state.key}-clone-`));

    // get the index to replace later
    const index = children.indexOf(row);

    if (index === -1) {
      throw new Error('Parent row not found in layout children');
    }

    // replace the row with the clone
    layout.setState({
      children: [...children.slice(0, index), rowClone, ...children.slice(index + 1)],
    });
  }

  public getParent(): SceneGridRow {
    if (!(this.parent instanceof SceneGridRow)) {
      throw new Error('RowActions must have a SceneGridRow parent');
    }

    return this.parent;
  }

  public getDashboard(): DashboardScene {
    return getDashboardSceneFor(this);
  }

  public onUpdate = (title: string, repeat?: string | null): void => {
    const row = this.getParent();

    // return early if there is no repeat
    if (!repeat) {
      const clone = row.clone();

      // remove the row repeater behaviour, leave the rest
      clone.setState({
        title,
        $behaviors: row.state.$behaviors?.filter((b) => !(b instanceof RowRepeaterBehavior)) ?? [],
      });

      this.updateLayout(clone);

      return;
    }

    const children = row.state.children.map((child) => child.clone());

    const newBehaviour = new RowRepeaterBehavior({
      variableName: repeat,
      sources: children,
    });

    // get rest of behaviors except the old row repeater, if any, and push new one
    const behaviors = row.state.$behaviors?.filter((b) => !(b instanceof RowRepeaterBehavior)) ?? [];
    behaviors.push(newBehaviour);

    row.setState({
      title,
      $behaviors: behaviors,
    });

    newBehaviour.activate();
  };

  public onDelete = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete row',
        text: 'Are you sure you want to remove this row and all its panels?',
        altActionText: 'Delete row only',
        icon: 'trash-alt',
        onConfirm: () => {
          this.getDashboard().removeRow(this.getParent(), true);
        },
        onAltAction: () => {
          this.getDashboard().removeRow(this.getParent());
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
    const { title } = row.useState();
    const { meta, isEditing } = dashboard.useState();
    const styles = useStyles2(getStyles);

    const behaviour = row.state.$behaviors?.find((b) => b instanceof RowRepeaterBehavior);

    return (
      <>
        {meta.canEdit && isEditing && (
          <>
            <div className={styles.rowActions}>
              <RowOptionsButton
                title={title}
                repeat={behaviour instanceof RowRepeaterBehavior ? behaviour.state.variableName : undefined}
                parent={dashboard}
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
      lineHeight: '27px',

      button: {
        color: theme.colors.text.secondary,
        paddingLeft: theme.spacing(2),
        background: 'transparent',
        border: 'none',

        '&:hover': {
          color: theme.colors.text.maxContrast,
        },
      },
    }),
  };
};
