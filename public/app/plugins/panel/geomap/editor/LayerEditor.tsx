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
  LookupSourceType,
  LookupSourceFiles,
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
          name: 'Lookup Field',
          settings: {
            filter: (f: Field) => f.type === FieldType.string,
            noFieldsMessage: 'No string fields found',
          },
          showIf: (opts: MapLayerOptions) => opts.location?.mode === FrameGeometrySourceMode.Lookup,
        })
        .addSelect({
          path: 'location.lookupSrc.mode',
          name: 'Lookup Source Option',
          settings: {
            options: [
              { value: LookupSourceType.File, label: 'Built-in File' },
              { value: LookupSourceType.JSON, label: 'JSON Endpoint' },
              { value: LookupSourceType.JSONP, label: 'JSONP Endpoint' },
            ],
          },
          showIf: (opts: MapLayerOptions) => opts.location?.mode === FrameGeometrySourceMode.Lookup,
        })
        .addSelect({
          path: 'location.lookupSrc.filePath',
          name: 'Lookup Source File',
          settings: {
            options: [
              { value: LookupSourceFiles.Countries, label: 'Countries' },
              { value: LookupSourceFiles.Countries_3Letter, label: 'Countries (3 Letter)' },
              { value: LookupSourceFiles.States, label: 'States' },
              { value: LookupSourceFiles.Probes, label: 'Probes' },
            ],
          },
          showIf: (opts: MapLayerOptions) =>
            opts.location?.mode === FrameGeometrySourceMode.Lookup &&
            opts.location?.lookupSrc?.type === LookupSourceType.File,
        })
        .addTextInput({
          path: 'location.lookupSrc.jsonEndpoint',
          name: 'JSON Endpoint',
          showIf: (opts: MapLayerOptions) =>
            opts.location?.mode === FrameGeometrySourceMode.Lookup &&
            opts.location?.lookupSrc?.type === LookupSourceType.JSON,
        })
        .addTextInput({
          path: 'location.lookupSrc.jsonpEndpoint',
          name: 'JSONP Endpoint',
          showIf: (opts: MapLayerOptions) =>
            opts.location?.mode === FrameGeometrySourceMode.Lookup &&
            opts.location?.lookupSrc?.type === LookupSourceType.JSONP,
        })
        .addTextInput({
          path: 'location.lookupSrc.jsonpCallback',
          name: 'JSONP Callback',
          showIf: (opts: MapLayerOptions) =>
            opts.location?.mode === FrameGeometrySourceMode.Lookup &&
            opts.location?.lookupSrc?.type === LookupSourceType.JSONP,
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

    const currentOptions = { ...options, config: { ...layer.defaultOptions, ...options?.config } };
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
