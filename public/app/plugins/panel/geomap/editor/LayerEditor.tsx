import React, { FC, useEffect, useMemo } from 'react';
import { Select } from '@grafana/ui';
import {
  MapLayerConfig,
  DataFrame,
  MapLayerRegistryItem,
  StandardEditorContext,
  StandardEditorsRegistryItem,
  PanelOptionsEditorBuilder,
} from '@grafana/data';
import { geomapLayerRegistry } from '../layers/registry';
import { defaultGrafanaThemedMap } from '../layers/basemaps';

export interface LayerEditorProps<TConfig = any> {
  config?: MapLayerConfig<TConfig>;
  data: DataFrame[]; // All results
  // TODO: figure out way to get builder and path into StandardEditorContext
  context: StandardEditorContext<any> & { builder: PanelOptionsEditorBuilder<any>; path: string };
  item: StandardEditorsRegistryItem;
  onChange: (config: MapLayerConfig<TConfig>) => void;
  filter: (item: MapLayerRegistryItem) => boolean;
}

export const LayerEditor: FC<LayerEditorProps> = ({ config, onChange, data, filter, item, context }) => {
  // all basemaps
  const layerTypes = useMemo(() => {
    return geomapLayerRegistry.selectOptions(
      config?.type // the selected value
        ? [config.type] // as an array
        : [defaultGrafanaThemedMap.id],
      filter
    );
  }, [config?.type, filter]);

  // The options change with each layer type and are dynamically registered
  useEffect(() => {
    const layer = geomapLayerRegistry.getIfExists(config?.type);
    if (!layer || !layer.registerOptionsUI) {
      return;
    }
    layer.registerOptionsUI(context.builder!, context.path);
  }, [config?.type, item, context.builder, context.path]);

  return (
    <Select
      options={layerTypes.options}
      value={layerTypes.current}
      onChange={(v) => {
        const layer = geomapLayerRegistry.getIfExists(v.value);
        if (!layer) {
          console.warn('layer does not exist', v);
          return;
        }
        onChange({
          type: layer.id,
          config: layer.defaultOptions, // clone?
        });
      }}
    />
  );
};
