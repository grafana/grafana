import React from 'react';

import { FieldConfigSource, PanelModel } from '@grafana/data';
import {
  SceneObjectState,
  VizPanel,
  SceneObjectBase,
  SceneComponentProps,
  sceneUtils,
  DeepPartial,
} from '@grafana/scenes';

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
    this._cachedPluginOptions[prevPluginId] = { options: prevOptions, fieldConfig: prevFieldConfig };
    const cachedOptions = this._cachedPluginOptions[pluginType]?.options;
    const cachedFieldConfig = this._cachedPluginOptions[pluginType]?.fieldConfig;

    const newPanel = new VizPanel({
      options: { ...prevOptions, ...cachedOptions },
      fieldConfig: { ...prevFieldConfig, ...cachedFieldConfig },
      ...restOfOldState,
      pluginId: pluginType,
    });

    const panel: PanelModel = {
      title: newPanel.state.title,
      options: newPanel.state.options,
      fieldConfig: newPanel.state.fieldConfig,
      id: 1,
      type: pluginType,
    };
    const newOptions = newPanel.getPlugin()?.onPanelTypeChanged?.(panel, prevPluginId, prevOptions, prevFieldConfig);
    if (newOptions) {
      newPanel.onOptionsChange(newOptions, true);
    }

    this.setState({ panel: newPanel });
  }

  public static Component = ({ model }: SceneComponentProps<VizPanelManager>) => {
    const { panel } = model.useState();

    return <panel.Component model={panel} />;
  };
}
