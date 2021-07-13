import React, { FC } from 'react';
import { StandardEditorProps, MapLayerConfig } from '@grafana/data';
import { GeomapPanelOptions } from '../types';
import { LayerEditor } from './LayerEditor';

export const BaseLayerEditor: FC<StandardEditorProps<MapLayerConfig, any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  return <LayerEditor config={value} data={context.data} onChange={onChange} filter={(v) => Boolean(v.isBaseMap)} />;
};
