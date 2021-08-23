import React, { FC, useMemo } from 'react';
import { StandardEditorProps, MapLayerRegistryItem, PluginState } from '@grafana/data';
import { GeomapPanelOptions } from '../types';
import { hasAlphaPanels } from 'app/core/config';
import { DEFAULT_BASEMAP_CONFIG, geomapLayerRegistry } from '../layers/registry';
import { Select } from '@grafana/ui';

function baseMapFilter(layer: MapLayerRegistryItem): boolean {
  if (!layer.isBaseMap) {
    return false;
  }
  if (layer.state === PluginState.alpha) {
    return hasAlphaPanels;
  }
  return true;
}

export interface LayerPickerSettings {
  onlyBasemaps: boolean;
}

export const LayerPickerEditor: FC<StandardEditorProps<string, LayerPickerSettings, GeomapPanelOptions>> = ({
  value,
  onChange,
  item,
}) => {
  // all basemaps
  const layerTypes = useMemo(() => {
    const onlyBasemaps = item.settings?.onlyBasemaps;
    const filter = onlyBasemaps ? baseMapFilter : undefined;

    return geomapLayerRegistry.selectOptions(
      value // the selected value
        ? [value] // as an array
        : [DEFAULT_BASEMAP_CONFIG.type],
      filter
    );
  }, [value, item.settings]);

  return (
    <div>
      <Select
        menuShouldPortal
        options={layerTypes.options}
        value={layerTypes.current}
        onChange={(v) => {
          const layer = geomapLayerRegistry.getIfExists(v.value);
          if (!layer) {
            console.warn('layer does not exist', v);
            return;
          }

          onChange(v.value);
          // onChange({
          //   ...options, // keep current options
          //   type: layer.id,
          //   config: { ...layer.defaultOptions }, // clone?
          // });
        }}
      />
    </div>
  );
};
