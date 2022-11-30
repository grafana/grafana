import React from 'react';

import { AbsoluteTimeRange, FieldConfigSource, PanelModel, PanelPlugin, toUtc } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Field, Input } from '@grafana/ui';
import { importPanelPlugin, syncGetPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { getPanelOptionsWithDefaults } from '../../../dashboard/state/getPanelOptionsWithDefaults';
import { SceneObjectBase } from '../../core/SceneObjectBase';
import { sceneGraph } from '../../core/sceneGraph';
import { SceneComponentProps, SceneLayoutChildState } from '../../core/types';

import { VizPanelRenderer } from './VizPanelRenderer';

export interface VizPanelState<TOptions = {}, TFieldConfig = {}> extends SceneLayoutChildState {
  title: string;
  pluginId: string;
  options: TOptions;
  fieldConfig: FieldConfigSource<TFieldConfig>;
  pluginVersion?: string;
  // internal state
  pluginLoadError?: string;
}

export class VizPanel<TOptions = {}, TFieldConfig = {}> extends SceneObjectBase<
  VizPanelState<Partial<TOptions>, TFieldConfig>
> {
  public static Component = VizPanelRenderer;
  public static Editor = VizPanelEditor;

  // Not part of state as this is not serializable
  private _plugin?: PanelPlugin;

  public constructor(state: Partial<VizPanelState<Partial<TOptions>, TFieldConfig>>) {
    super({
      options: {},
      fieldConfig: { defaults: {}, overrides: [] },
      title: 'Title',
      pluginId: 'timeseries',
      ...state,
    });
  }

  public activate() {
    super.activate();

    const plugin = syncGetPanelPlugin(this.state.pluginId);

    if (plugin) {
      this.pluginLoaded(plugin);
    } else {
      importPanelPlugin(this.state.pluginId)
        .then((result) => this.pluginLoaded(result))
        .catch((err: Error) => {
          this.setState({ pluginLoadError: err.message });
        });
    }
  }

  private pluginLoaded(plugin: PanelPlugin) {
    const { options, fieldConfig, title, pluginId, pluginVersion } = this.state;

    const panel: PanelModel = { title, options, fieldConfig, id: 1, type: pluginId, pluginVersion: pluginVersion };
    const currentVersion = this.getPluginVersion(plugin);

    if (plugin.onPanelMigration) {
      if (currentVersion !== this.state.pluginVersion) {
        // These migration handlers also mutate panel.fieldConfig to migrate fieldConfig
        panel.options = plugin.onPanelMigration(panel);
      }
    }

    const withDefaults = getPanelOptionsWithDefaults({
      plugin,
      currentOptions: panel.options,
      currentFieldConfig: panel.fieldConfig,
      isAfterPluginChange: false,
    });

    this._plugin = plugin;
    this.setState({
      options: withDefaults.options,
      fieldConfig: withDefaults.fieldConfig,
      pluginVersion: currentVersion,
    });
  }

  private getPluginVersion(plugin: PanelPlugin): string {
    return plugin && plugin.meta.info.version ? plugin.meta.info.version : config.buildInfo.version;
  }

  public getPlugin(): PanelPlugin | undefined {
    return this._plugin;
  }

  public onChangeTimeRange = (timeRange: AbsoluteTimeRange) => {
    const sceneTimeRange = sceneGraph.getTimeRange(this);
    sceneTimeRange.onTimeRangeChange({
      raw: {
        from: toUtc(timeRange.from),
        to: toUtc(timeRange.to),
      },
      from: toUtc(timeRange.from),
      to: toUtc(timeRange.to),
    });
  };

  public onOptionsChange = (options: TOptions) => {
    this.setState({ options });
  };

  public onFieldConfigChange = (fieldConfig: FieldConfigSource) => {
    this.setState({ fieldConfig });
  };
}

function VizPanelEditor({ model }: SceneComponentProps<VizPanel>) {
  const { title } = model.useState();

  return (
    <Field label="Title">
      <Input defaultValue={title} onBlur={(evt) => model.setState({ title: evt.currentTarget.value })} />
    </Field>
  );
}
