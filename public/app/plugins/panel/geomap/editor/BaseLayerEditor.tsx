import React, { FC } from 'react';
import { StandardEditorProps, MapLayerOptions, MapLayerRegistryItem, PluginState } from '@grafana/data';
import { GeomapPanelOptions } from '../types';
import { LayerEditor } from './LayerEditor';
import { hasAlphaPanels } from 'app/core/config';

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
  return <LayerEditor options={value} data={context.data} onChange={onChange} filter={baseMapFilter} />;
};
