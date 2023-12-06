import React from 'react';

import {
  FieldConfigSource,
  PanelModel,
  filterFieldConfigOverrides,
  isStandardFieldProp,
  restoreCustomOverrideRules,
} from '@grafana/data';
import {
  SceneObjectState,
  VizPanel,
  SceneObjectBase,
  SceneComponentProps,
  sceneUtils,
  DeepPartial,
} from '@grafana/scenes';
import { getPluginVersion } from 'app/features/dashboard/state/PanelModel';

interface VizPanelManagerState extends SceneObjectState {
  panel: VizPanel;
}

export class VizPanelManager extends SceneObjectBase<VizPanelManagerState> {
  private _cachedPluginOptions: Record<
    string,
    { options: DeepPartial<{}>; fieldConfig: FieldConfigSource<DeepPartial<{}>> } | undefined
  > = {};

  public constructor(panel: VizPanel) {
    super({ panel });
  }

  public changePluginType(pluginType: string) {
    const {
      options: prevOptions,
      fieldConfig: prevFieldConfig,
      pluginId: prevPluginId,
      ...restOfOldState
    } = sceneUtils.cloneSceneObjectState(this.state.panel.state);

    // clear custom options
    let newFieldConfig = { ...prevFieldConfig };
    newFieldConfig.defaults = {
      ...newFieldConfig.defaults,
      custom: {},
    };
    newFieldConfig.overrides = filterFieldConfigOverrides(newFieldConfig.overrides, isStandardFieldProp);

    this._cachedPluginOptions[prevPluginId] = { options: prevOptions, fieldConfig: prevFieldConfig };
    const cachedOptions = this._cachedPluginOptions[pluginType]?.options;
    const cachedFieldConfig = this._cachedPluginOptions[pluginType]?.fieldConfig;
    if (cachedFieldConfig) {
      newFieldConfig = restoreCustomOverrideRules(newFieldConfig, cachedFieldConfig);
    }

    const newPanel = new VizPanel({
      options: cachedOptions ?? {},
      fieldConfig: newFieldConfig,
      pluginId: pluginType,
      ...restOfOldState,
    });

    const newPlugin = newPanel.getPlugin();
    const panel: PanelModel = {
      title: newPanel.state.title,
      options: newPanel.state.options,
      fieldConfig: newPanel.state.fieldConfig,
      id: 1,
      type: pluginType,
    };
    const newOptions = newPlugin?.onPanelTypeChanged?.(panel, prevPluginId, prevOptions, prevFieldConfig);
    if (newOptions) {
      newPanel.onOptionsChange(newOptions, true);
    }

    if (newPlugin?.onPanelMigration) {
      newPanel.setState({ pluginVersion: getPluginVersion(newPlugin) });
    }

    this.setState({ panel: newPanel });
  }

  public static Component = ({ model }: SceneComponentProps<VizPanelManager>) => {
    const { panel } = model.useState();

    return <panel.Component model={panel} />;
  };
}
