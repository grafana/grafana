import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  AbsoluteTimeRange,
  FieldConfigSource,
  PanelModel,
  PanelPlugin,
  PluginContextProvider,
  toUtc,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { Field, PanelChrome, Input, ErrorBoundaryAlert } from '@grafana/ui';
import { appEvents } from 'app/core/core';
import { useFieldOverrides } from 'app/features/panel/components/PanelRenderer';
import { importPanelPlugin, syncGetPanelPlugin } from 'app/features/plugins/importPanelPlugin';

import { getPanelOptionsWithDefaults } from '../../dashboard/state/getPanelOptionsWithDefaults';
import { SceneObjectBase } from '../core/SceneObjectBase';
import { SceneComponentProps, SceneLayoutChildState } from '../core/types';

export interface VizPanelState extends SceneLayoutChildState {
  title: string;
  pluginId: string;
  options: object;
  fieldConfig: FieldConfigSource;
  pluginVersion?: string;
  // internal state
  pluginLoadError?: string;
}

export class VizPanel extends SceneObjectBase<VizPanelState> {
  public static Component = ScenePanelRenderer;
  public static Editor = VizPanelEditor;

  // Not part of state as this is not serializable
  private _plugin?: PanelPlugin;

  public getPlugin(): PanelPlugin | undefined {
    return this._plugin;
  }

  public constructor(state: Partial<VizPanelState>) {
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
    const { options, fieldConfig, title, pluginId } = this.state;

    const version = this.getPluginVersion(plugin);
    const panel: PanelModel = { title, options, fieldConfig, id: 1, type: pluginId, pluginVersion: version };

    if (plugin.onPanelMigration) {
      if (version !== this.state.pluginVersion) {
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
    this.setState({ options: withDefaults.options, fieldConfig: withDefaults.fieldConfig, pluginVersion: version });
  }

  private getPluginVersion(plugin: PanelPlugin): string {
    return plugin && plugin.meta.info.version ? plugin.meta.info.version : config.buildInfo.version;
  }

  public onChangeTimeRange = (timeRange: AbsoluteTimeRange) => {
    const sceneTimeRange = this.getTimeRange();
    sceneTimeRange.setState({
      raw: {
        from: toUtc(timeRange.from),
        to: toUtc(timeRange.to),
      },
      from: toUtc(timeRange.from),
      to: toUtc(timeRange.to),
    });
  };

  public onOptionsChange = (options: object) => {
    this.setState({ options });
  };

  public onFieldConfigChange = (fieldConfig: FieldConfigSource) => {
    this.setState({ fieldConfig });
  };
}

function ScenePanelRenderer({ model }: SceneComponentProps<VizPanel>) {
  const { title, options, fieldConfig, pluginId, pluginLoadError } = model.useState();
  const { data } = model.getData().useState();
  const plugin = model.getPlugin();

  // Not sure we need to subscribe to this state
  const timeZone = model.getTimeRange().state.timeZone;

  const dataWithOverrides = useFieldOverrides(plugin, fieldConfig, data, timeZone);

  if (pluginLoadError) {
    return <div>Failed to load plugin: {pluginLoadError}</div>;
  }

  if (!plugin || !plugin.hasPluginId(pluginId)) {
    return <div>Loading plugin panel...</div>;
  }

  if (!plugin.panel) {
    return <div>Panel plugin has no panel component</div>;
  }

  if (!dataWithOverrides) {
    return <div>No panel data</div>;
  }

  const PanelComponent = plugin.panel;

  return (
    <AutoSizer>
      {({ width, height }) => {
        if (width < 3 || height < 3) {
          return null;
        }

        return (
          <PanelChrome title={title} width={width} height={height}>
            {(innerWidth, innerHeight) => (
              <ErrorBoundaryAlert dependencies={[plugin, data]}>
                <PluginContextProvider meta={plugin.meta}>
                  <PanelComponent
                    id={1}
                    data={dataWithOverrides}
                    title={title}
                    timeRange={dataWithOverrides.timeRange}
                    timeZone={timeZone}
                    options={options}
                    fieldConfig={fieldConfig}
                    transparent={false}
                    width={innerWidth}
                    height={innerHeight}
                    renderCounter={0}
                    replaceVariables={(str: string) => str}
                    onOptionsChange={model.onOptionsChange}
                    onFieldConfigChange={model.onFieldConfigChange}
                    onChangeTimeRange={model.onChangeTimeRange}
                    eventBus={appEvents}
                  />
                </PluginContextProvider>
              </ErrorBoundaryAlert>
            )}
          </PanelChrome>
        );
      }}
    </AutoSizer>
  );
}

ScenePanelRenderer.displayName = 'ScenePanelRenderer';

function VizPanelEditor({ model }: SceneComponentProps<VizPanel>) {
  const { title } = model.useState();

  return (
    <Field label="Title">
      <Input defaultValue={title} onBlur={(evt) => model.setState({ title: evt.currentTarget.value })} />
    </Field>
  );
}
