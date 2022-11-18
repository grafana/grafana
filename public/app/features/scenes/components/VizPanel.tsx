import React, { RefCallback } from 'react';
import { useMeasure } from 'react-use';

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
import { sceneGraph } from '../core/sceneGraph';
import { SceneComponentProps, SceneLayoutChildState } from '../core/types';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';

import { SceneDragHandle } from './SceneDragHandle';

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

  public getPlugin(): PanelPlugin | undefined {
    return this._plugin;
  }

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

  public onChangeTimeRange = (timeRange: AbsoluteTimeRange) => {
    const sceneTimeRange = sceneGraph.getTimeRange(this);
    sceneTimeRange.setState({
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

function VizPanelRenderer({ model }: SceneComponentProps<VizPanel>) {
  const { title, options, fieldConfig, pluginId, pluginLoadError, $data, ...state } = model.useState();
  const [ref, { width, height }] = useMeasure();
  const plugin = model.getPlugin();
  const { data } = sceneGraph.getData(model).useState();
  const layout = sceneGraph.getLayout(model);

  const isDraggable = layout.state.isDraggable ? state.isDraggable : false;
  const dragHandle = <SceneDragHandle layoutKey={layout.state.key!} />;

  const titleInterpolated = sceneGraph.interpolate(model, title);

  // Not sure we need to subscribe to this state
  const timeZone = sceneGraph.getTimeRange(model).state.timeZone;

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

  const PanelComponent = plugin.panel;

  // Query runner needs to with for auto maxDataPoints
  if ($data instanceof SceneQueryRunner) {
    $data.setContainerWidth(width);
  }

  return (
    <div ref={ref as RefCallback<HTMLDivElement>} style={{ width: '100%', height: '100%' }}>
      <PanelChrome
        title={titleInterpolated}
        width={width}
        height={height}
        leftItems={isDraggable ? [dragHandle] : undefined}
      >
        {(innerWidth, innerHeight) => (
          <>
            {!dataWithOverrides && <div>No data...</div>}
            {dataWithOverrides && (
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
          </>
        )}
      </PanelChrome>
    </div>
  );
}

VizPanelRenderer.displayName = 'ScenePanelRenderer';

function VizPanelEditor({ model }: SceneComponentProps<VizPanel>) {
  const { title } = model.useState();

  return (
    <Field label="Title">
      <Input defaultValue={title} onBlur={(evt) => model.setState({ title: evt.currentTarget.value })} />
    </Field>
  );
}
