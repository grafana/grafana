import { PanelModel } from '@grafana/data';
import { SceneDataTransformer, VizPanel } from '@grafana/scenes';
import { DataSourceRef, DataTransformerConfig } from '@grafana/schema';

import { LibraryVizPanel } from '../scene/LibraryVizPanel';

import { getPanelIdForVizPanel, getQueryRunnerFor } from './utils';

export class PanelModelCompatibilityWrapper implements PanelModel {
  constructor(private _vizPanel: VizPanel) {}

  public get id() {
    const id = getPanelIdForVizPanel(
      this._vizPanel.parent instanceof LibraryVizPanel ? this._vizPanel.parent : this._vizPanel
    );

    if (isNaN(id)) {
      console.error('VizPanel key could not be translated to a legacy numeric panel id', this._vizPanel);
      return 0;
    }

    return id;
  }

  public get description() {
    return this._vizPanel.state.description;
  }

  public get type() {
    return this._vizPanel.state.pluginId;
  }

  public get title() {
    return this._vizPanel.state.title;
  }

  public get transformations() {
    if (this._vizPanel.state.$data instanceof SceneDataTransformer) {
      return this._vizPanel.state.$data.state.transformations as DataTransformerConfig[];
    }

    return [];
  }

  public get targets() {
    const queryRunner = getQueryRunnerFor(this._vizPanel);
    if (!queryRunner) {
      return [];
    }

    return queryRunner.state.queries;
  }

  public get datasource(): DataSourceRef | null | undefined {
    const queryRunner = getQueryRunnerFor(this._vizPanel);
    return queryRunner?.state.datasource;
  }

  public get options() {
    return this._vizPanel.state.options;
  }

  public get fieldConfig() {
    return this._vizPanel.state.fieldConfig;
  }

  public get pluginVersion() {
    return this._vizPanel.state.pluginVersion;
  }
}
