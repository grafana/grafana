import React, { FC, useMemo } from 'react';
import { Select } from '@grafana/ui';
import { MapLayerConfig, DataFrame, MapLayerRegistryItem } from '@grafana/data';
import { geomapLayerRegistry } from '../layers/registry';
import { defaultGrafanaThemedMap } from '../layers/basemaps/theme';

export interface LayerEditorProps<TConfig = any> {
  config?: MapLayerConfig<TConfig>;
  data: DataFrame[]; // All results
  onChange: (config: MapLayerConfig<TConfig>) => void;
  filter: (item: MapLayerRegistryItem) => boolean;
}

export const LayerEditor: FC<LayerEditorProps> = ({ config, onChange, data, filter }) => {
  // all basemaps
  const opts = useMemo(() => {
    return geomapLayerRegistry.selectOptions(
      config?.type // the selected value
        ? [config.type] // as an array
        : [defaultGrafanaThemedMap.id],
      filter
    );
  }, [config?.type, filter]);

  return (
    <div>
      <Select
        options={opts.options}
        value={opts.current}
        onChange={(v) => {
          console.log('changed!', v);
          onChange({
            type: v.value!, // the map type
          });
        }}
      />

      {opts.current && <div>TODO: show more options....</div>}
    </div>
  );
};

// const getStyles = stylesFactory((theme: GrafanaTheme) => ({
//   editorBox: css`
//     label: editorBox;
//     border: ${theme.border.width.sm} solid ${theme.colors.border2};
//     border-radius: ${theme.border.radius.sm};
//     margin: ${theme.spacing.xs} 0;
//     width: 100%;
//   `,
// }));
