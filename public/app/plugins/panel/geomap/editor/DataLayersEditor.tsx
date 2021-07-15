import React, { FC } from 'react';
import { StandardEditorProps, MapLayerOptions } from '@grafana/data';
import { GeomapPanelOptions } from '../types';
import { LayerEditor } from './LayerEditor';

// For now this supports a *single* data layer -- eventually we should support more than one
export const DataLayersEditor: FC<StandardEditorProps<MapLayerOptions[], any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  return (
    <LayerEditor
      options={value?.length ? value[0] : undefined}
      data={context.data}
      onChange={(cfg) => {
        console.log('Change overlays:', cfg);
        onChange([cfg]);
      }}
      filter={(v) => !v.isBaseMap}
    />
  );
};
