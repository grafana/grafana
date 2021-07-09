import React, { FC } from 'react';
import { StandardEditorProps, MapLayerConfig } from '@grafana/data';
import { GeomapPanelOptions } from '../types';
import { LayerEditor } from './LayerEditor';

// For now this supports a *single* data layer -- eventually we should support more than one
export const DataLayersEditor: FC<StandardEditorProps<MapLayerConfig[], any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  return (
    <LayerEditor
      config={value?.length ? value[0] : undefined}
      data={context.data}
      onChange={(cfg) => {
        console.log('Change overlays:', cfg);
        onChange([cfg]);
      }}
      filter={(v) => !v.isBaseMap}
    />
  );
};
