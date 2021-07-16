import React, { FC } from 'react';
import { StandardEditorProps, MapLayerOptions } from '@grafana/data';
import { GeomapPanelOptions } from '../types';
import { LayerEditor } from './LayerEditor';

export const BaseLayerEditor: FC<StandardEditorProps<MapLayerOptions, any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  return <LayerEditor options={value} data={context.data} onChange={onChange} filter={(v) => Boolean(v.isBaseMap)} />;
};
