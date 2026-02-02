import { FieldConfigSource, PanelModel, PanelPlugin } from '@grafana/data';
import { SceneDataTransformer, VizPanel } from '@grafana/scenes';
import { DataSourceRef, DataTransformerConfig } from '@grafana/schema';

import { getPanelIdForVizPanel, getQueryRunnerFor } from './utils';

export class PanelModelCompatibilityWrapper implements PanelModel {
  // BMC Change: Inline
  // Made _vizPanel public for Report generation
  constructor(public _vizPanel: VizPanel) {}

  public get id() {
    const id = getPanelIdForVizPanel(this._vizPanel);

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

  // BMC Change: start
  // Function to get state key (new panel id)
  public get key() {
    return this._vizPanel.state.key!;
  }

  /**
   * Compatibility method so callers that expect the classic `PanelModel`
   * API (like `changePlugin` in `panel/state/actions.ts`) can switch
   * visualization type when running in scenes.
   */
  public changePlugin(newPlugin: PanelPlugin) {
    const pluginId = newPlugin.meta.id;

    this._vizPanel.changePluginType(pluginId, this.options, this.fieldConfig as FieldConfigSource);
  }
  // BMC Change: end
}
