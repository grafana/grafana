import React, { FC, useMemo } from 'react';
import { Select } from '@grafana/ui';
import {
  MapLayerOptions,
  DataFrame,
  MapLayerRegistryItem,
  PanelOptionsEditorBuilder,
  StandardEditorContext,
  FrameGeometrySourceMode,
  FieldType,
  Field,
  LookupSourceOptions,
} from '@grafana/data';
import { geomapLayerRegistry } from '../layers/registry';
import { defaultGrafanaThemedMap } from '../layers/basemaps';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { fillOptionsPaneItems } from 'app/features/dashboard/components/PanelEditor/getVizualizationOptions';

export interface LayerEditorProps<TConfig = any> {
  options?: MapLayerOptions<TConfig>;
  data: DataFrame[]; // All results
  onChange: (options: MapLayerOptions<TConfig>) => void;
  filter: (item: MapLayerRegistryItem) => boolean;
}

export const LayerEditor: FC<LayerEditorProps> = ({ options, onChange, data, filter }) => {
  // all basemaps
  const layerTypes = useMemo(() => {
    return geomapLayerRegistry.selectOptions(
      options?.type // the selected value
        ? [options.type] // as an array
        : [defaultGrafanaThemedMap.id],
      filter
    );
  }, [options?.type, filter]);

  // The options change with each layer type
  const optionsEditorBuilder = useMemo(() => {
    const layer = geomapLayerRegistry.getIfExists(options?.type);
    if (!layer || !(layer.registerOptionsUI || layer.showLocation || layer.showOpacity)) {
      return null;
    }

    const builder = new PanelOptionsEditorBuilder();
    if (layer.showLocation) {
      builder
        .addRadio({
          path: 'location.mode',
          name: 'Location',
          description: '',
          defaultValue: FrameGeometrySourceMode.Auto,
          settings: {
            options: [
              { value: FrameGeometrySourceMode.Auto, label: 'Auto' },
              { value: FrameGeometrySourceMode.Coords, label: 'Coords' },
              { value: FrameGeometrySourceMode.Geohash, label: 'Geohash' },
              { value: FrameGeometrySourceMode.Lookup, label: 'Lookup' },
            ],
          },
        })
        .addFieldNamePicker({
          path: 'location.latitude',
          name: 'Latitude Field',
          settings: {
            filter: (f: Field) => f.type === FieldType.number,
            noFieldsMessage: 'No numeric fields found',
          },
          showIf: (opts: MapLayerOptions) => opts.location?.mode === FrameGeometrySourceMode.Coords,
        })
        .addFieldNamePicker({
          path: 'location.longitude',
          name: 'Longitude Field',
          settings: {
            filter: (f: Field) => f.type === FieldType.number,
            noFieldsMessage: 'No numeric fields found',
          },
          showIf: (opts: MapLayerOptions) => opts.location?.mode === FrameGeometrySourceMode.Coords,
        })
        .addFieldNamePicker({
          path: 'location.geohash',
          name: 'Geohash Field',
          settings: {
            filter: (f: Field) => f.type === FieldType.string,
            noFieldsMessage: 'No strings fields found',
          },
          showIf: (opts: MapLayerOptions) => opts.location?.mode === FrameGeometrySourceMode.Geohash,
          // eslint-disable-next-line react/display-name
          // info: (props) => <div>HELLO</div>,
        })
        .addFieldNamePicker({
          path: 'location.lookup',
          name: 'Lookup field',
          settings: {
            filter: (f: Field) => f.type === FieldType.string,
            noFieldsMessage: 'No string fields found',
          },
          showIf: (opts: MapLayerOptions) => opts.location?.mode === FrameGeometrySourceMode.Lookup,
        })
        .addSelect({
          path: 'location.lookupSrc',
          name: 'Lookup source option',
          settings: {
            options: [
              { value: LookupSourceOptions.Countries, label: 'Countries' },
              { value: LookupSourceOptions.Countries_3Letter, label: 'Countries (3 Letter)' },
              { value: LookupSourceOptions.States, label: 'States' },
              { value: LookupSourceOptions.Probes, label: 'Probes' },
              { value: LookupSourceOptions.JSONEndpoint, label: 'JSON Endpoint' },
            ],
          },
          showIf: (opts: MapLayerOptions) => opts.location?.mode === FrameGeometrySourceMode.Lookup,
        })
        .addTextInput({
          path: 'location.lookupSrcEndpoint',
          name: 'JSON endpoint',
          showIf: (opts: MapLayerOptions) =>
            opts.location?.mode === FrameGeometrySourceMode.Lookup &&
            opts.location?.lookupSrc === LookupSourceOptions.JSONEndpoint,
        });
    }
    if (layer.registerOptionsUI) {
      layer.registerOptionsUI(builder);
    }
    if (layer.showOpacity) {
      // TODO -- add opacity check
    }
    return builder;
  }, [options?.type]);

  // The react componnets
  const layerOptions = useMemo(() => {
    const layer = geomapLayerRegistry.getIfExists(options?.type);
    if (!optionsEditorBuilder || !layer) {
      return null;
    }

    const category = new OptionsPaneCategoryDescriptor({
      id: 'Layer config',
      title: 'Layer config',
    });

    const context: StandardEditorContext<any> = {
      data,
      options: options,
    };

    const currentOptions = { ...options, type: layer.id, config: { ...layer.defaultOptions, ...options?.config } };

    // Update the panel options if not set
    if (!options || (layer.defaultOptions && !options.config)) {
      onChange(currentOptions as any);
    }

    const reg = optionsEditorBuilder.getRegistry();

    // Load the options into categories
    fillOptionsPaneItems(
      reg.list(),

      // Always use the same category
      (categoryNames) => category,

      // Custom upate function
      (path: string, value: any) => {
        onChange(setOptionImmutably(currentOptions, path, value) as any);
      },
      context
    );

    return (
      <>
        <br />
        {category.items.map((item) => item.render())}
      </>
    );
  }, [optionsEditorBuilder, onChange, data, options]);

  return (
    <div>
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
            ...options, // keep current options
            type: layer.id,
            config: { ...layer.defaultOptions }, // clone?
          });
        }}
      />

      {layerOptions}
    </div>
  );
};
