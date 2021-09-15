import React, { FC } from 'react';
import { StandardEditorProps, MapLayerOptions, MapLayerRegistryItem, PluginState } from '@grafana/data';
import { GeomapPanelOptions } from '../types';
import { LayerEditor } from './LayerEditor';
import { config, hasAlphaPanels } from 'app/core/config';

function baseMapFilter(layer: MapLayerRegistryItem): boolean {
  if (!layer.isBaseMap) {
    return false;
  }
  if (layer.state === PluginState.alpha) {
    return hasAlphaPanels;
  }
  return true;
}

export const BaseLayerEditor: FC<StandardEditorProps<MapLayerOptions, any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  if (config.geomapDisableCustomBaseLayer) {
    return <div>The base layer is configured by the server admin.</div>;
  }

  return <LayerEditor options={value} data={context.data} onChange={onChange} filter={baseMapFilter} />;
};
