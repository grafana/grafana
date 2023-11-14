import React from 'react';

import {
  SceneComponentProps,
  SceneGridRow,
  SceneObject,
  SceneObjectBase,
  SceneObjectRef,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { Spinner } from '@grafana/ui';

import { DashboardScene } from '../scene/DashboardScene';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { DashboardRepeatsProcessedEvent } from '../scene/types';
import { findVizPanelByKey } from '../utils/utils';

export interface SoloPanelSceneState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
  panelId: string;
  timezone?: string;
  error?: string;
  panelRef?: SceneObjectRef<SceneObject>;
}

export class SoloPanelScene extends SceneObjectBase<SoloPanelSceneState> {
  public constructor(state: SoloPanelSceneState) {
    super(state);

    this.addActivationHandler(this._activationHandler.bind(this));
  }

  private _activationHandler() {
    const dashboard = this.state.dashboardRef.resolve();

    if (this.state.timezone) {
      dashboard.state.$timeRange!.onTimeZoneChange(this.state.timezone);
    }

    dashboard.startUrlSync();
    dashboard.activate();

    const panel = findVizPanelByKey(dashboard, this.state.panelId);
    if (panel) {
      this._foundPanel(panel);
    } else {
      if (this.state.panelId.indexOf('clone')) {
        this._handleRepeatClone(dashboard);
        return;
      }

      this.setState({ error: 'Panel not found' });
    }
  }

  private _activateAllRepeaters(layout: SceneObject) {
    layout.forEachChild((child) => {
      if (child instanceof PanelRepeaterGridItem && !child.isActive) {
        child.activate();
        return;
      }

      if (child instanceof SceneGridRow && child.state.$behaviors) {
        for (const behavior of child.state.$behaviors) {
          if (behavior instanceof RowRepeaterBehavior && !child.isActive) {
            child.activate();
            break;
          }
        }

        // Activate any panel PanelRepeaterGridItem inside the row
        this._activateAllRepeaters(child);
      }
    });
  }

  private _foundPanel(panel: VizPanel) {
    // solo / embedded panels have no menu
    panel.setState({ menu: undefined });
    this.setState({ panelRef: panel.getRef() });
  }

  /**
   * Activates all repeater objects and subscribes to the DashboardRepeatsProcessedEvent event
   */
  private _handleRepeatClone(dashboard: DashboardScene) {
    dashboard.subscribeToEvent(DashboardRepeatsProcessedEvent, () => {
      const panel = findVizPanelByKey(dashboard, this.state.panelId);
      if (panel) {
        this._foundPanel(panel);
      } else {
        // If rows are repeated they could add new panel repeaters that needs to be activated
        this._activateAllRepeaters(dashboard.state.body);
      }
    });

    this._activateAllRepeaters(dashboard.state.body);
  }

  static Component = ({ model }: SceneComponentProps<SoloPanelScene>) => {
    const { panelRef, error } = model.useState();

    if (error) {
      return <div>{error}</div>;
    }

    if (!panelRef) {
      return (
        <span>
          Loading <Spinner />
        </span>
      );
    }

    const panel = panelRef.resolve();

    return (
      <div className="panel-solo">
        <panel.Component model={panel} />
      </div>
    );
  };
}
